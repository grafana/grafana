package folderimpl

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"slices"
	"strings"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const FULLPATH_SEPARATOR = "/"

var (
	_ folder.Service = (*Service)(nil)
)

type Service struct {
	unifiedStore           folder.Store
	log                    *slog.Logger
	features               featuremgmt.FeatureToggles
	accessControl          accesscontrol.AccessControl
	k8sclient              client.K8sHandler
	maxNestedFolderDepth   int
	dashboardK8sClient     client.K8sHandler
	publicDashboardService publicdashboards.ServiceWrapper

	mutex    sync.RWMutex
	registry map[string]folder.RegistryService
	tracer   trace.Tracer
}

func ProvideService(
	ac accesscontrol.AccessControl,
	userService user.Service,
	features featuremgmt.FeatureToggles,
	supportBundles supportbundles.Service,
	publicDashboardService publicdashboards.ServiceWrapper,
	cfg *setting.Cfg,
	r prometheus.Registerer,
	tracer trace.Tracer,
	resourceClient resource.ResourceClient,
	sorter sort.Service,
	restConfig apiserver.RestConfigProvider,
) *Service {
	srv := &Service{
		log:                    slog.Default().With("logger", "folder-service"),
		features:               features,
		accessControl:          ac,
		registry:               make(map[string]folder.RegistryService),
		tracer:                 tracer,
		publicDashboardService: publicDashboardService,
		maxNestedFolderDepth:   cfg.MaxNestedFolderDepth,
	}

	supportBundles.RegisterSupportItemCollector(srv.supportBundleCollector())

	ac.RegisterScopeAttributeResolver(folder.NewFolderIDScopeResolver(srv.getUIDFromLegacyID, srv))
	ac.RegisterScopeAttributeResolver(folder.NewFolderUIDScopeResolver(srv))

	k8sHandler := client.NewK8sHandler(
		request.GetNamespaceMapper(cfg),
		folderv1.FolderResourceInfo.GroupVersionResource(),
		restConfig.GetRestConfig,
		userService,
		resourceClient,
	)

	unifiedStore := ProvideUnifiedStore(k8sHandler, userService, tracer, cfg)

	srv.unifiedStore = unifiedStore
	srv.k8sclient = k8sHandler

	dashHandler := client.NewK8sHandler(
		request.GetNamespaceMapper(cfg),
		dashboardv1.DashboardResourceInfo.GroupVersionResource(),
		restConfig.GetRestConfig,
		userService,
		resourceClient,
	)
	srv.dashboardK8sClient = dashHandler

	return srv
}

func (s *Service) getUIDFromLegacyID(ctx context.Context, orgID int64, id int64) (string, error) {
	f, err := s.getFolderByID(ctx, id, orgID)
	if err != nil {
		return "", err
	}
	return f.UID, nil
}

func (s *Service) CountFoldersInOrg(ctx context.Context, orgID int64) (int64, error) {
	ctx, span := s.tracer.Start(ctx, "folder.CountFoldersInOrg")
	defer span.End()
	return s.unifiedStore.CountInOrg(ctx, orgID)
}

func (s *Service) setFullpath(ctx context.Context, f *folder.Folder, forceLegacy bool) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.setFullpath")
	defer span.End()

	if f.ParentUID == "" {
		return f, nil
	}

	// Fetch the parent since the permissions for fetching the newly created folder
	// are not yet present for the user--this requires a call to ClearUserPermissionCache
	parents, err := s.GetParents(ctx, folder.GetParentsQuery{
		UID:   f.UID,
		OrgID: f.OrgID,
	})
	if err != nil {
		return nil, err
	}
	// #TODO revisit setting permissions so that we can centralise the logic for escaping slashes in titles
	// Escape forward slashes in the title
	f.Fullpath, f.FullpathUIDs = computeFullPath(append(parents, f))
	return f, nil
}

// GetSharedWithMe returns folders available to user, which cannot be accessed from the root folders
func (s *Service) GetSharedWithMe(ctx context.Context, q *folder.GetChildrenQuery, forceLegacy bool) ([]*folder.FolderReference, error) {
	ctx, span := s.tracer.Start(ctx, "folder.GetSharedWithMe")
	defer span.End()
	availableNonRootFolders, err := s.getAvailableNonRootFolders(ctx, q, forceLegacy)
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to fetch subfolders to which the user has explicit access: %w", err)
	}
	rootFolders, err := s.GetChildren(ctx, &folder.GetChildrenQuery{UID: "", OrgID: q.OrgID, SignedInUser: q.SignedInUser, Permission: q.Permission})
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to fetch root folders to which the user has access: %w", err)
	}

	dedupAvailableNonRootFolders := s.deduplicateAvailableFolders(ctx, availableNonRootFolders, rootFolders)
	return dedupAvailableNonRootFolders, nil
}

func (s *Service) getAvailableNonRootFolders(ctx context.Context, q *folder.GetChildrenQuery, forceLegacy bool) ([]*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getAvailableNonRootFolders")
	defer span.End()
	permissions := q.SignedInUser.GetPermissions()
	var folderPermissions []string
	if q.Permission == dashboardaccess.PERMISSION_EDIT {
		folderPermissions = permissions[folder.ActionFoldersWrite]
		folderPermissions = append(folderPermissions, permissions[dashboards.ActionDashboardsWrite]...)
	} else {
		folderPermissions = permissions[folder.ActionFoldersRead]
		folderPermissions = append(folderPermissions, permissions[dashboards.ActionDashboardsRead]...)
	}

	if len(folderPermissions) == 0 {
		return nil, nil
	}

	nonRootFolders := make([]*folder.Folder, 0)
	folderUids := make([]string, 0, len(folderPermissions))
	for _, p := range folderPermissions {
		if folderUid, found := strings.CutPrefix(p, folder.ScopeFoldersPrefix); found {
			if !slices.Contains(folderUids, folderUid) {
				folderUids = append(folderUids, folderUid)
			}
		}
	}

	if len(folderUids) == 0 {
		return nonRootFolders, nil
	}

	dashFolders, err := s.GetFolders(ctx, folder.GetFoldersQuery{
		UIDs:             folderUids,
		OrgID:            q.OrgID,
		SignedInUser:     q.SignedInUser,
		OrderByTitle:     true,
		WithFullpathUIDs: true,
	})
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to fetch subfolders: %w", err)
	}

	for _, f := range dashFolders {
		if f.ParentUID != "" {
			nonRootFolders = append(nonRootFolders, f)
		}
	}

	return nonRootFolders, nil
}

func (s *Service) deduplicateAvailableFolders(ctx context.Context, folders []*folder.Folder, rootFolders []*folder.FolderReference) []*folder.FolderReference {
	foldersRef := make([]*folder.FolderReference, len(folders))
	for i, f := range folders {
		foldersRef[i] = f.ToFolderReference()
	}

	_, span := s.tracer.Start(ctx, "folder.deduplicateAvailableFolders")
	defer span.End()
	allFolders := append(foldersRef, rootFolders...)
	foldersDedup := make([]*folder.FolderReference, 0)

	for _, f := range folders {
		isSubfolder := slices.ContainsFunc(allFolders, func(folder *folder.FolderReference) bool {
			return f.ParentUID == folder.UID
		})

		if !isSubfolder {
			// Get parents UIDs
			parentUIDs := make([]string, 0)
			pathUIDs := strings.Split(f.FullpathUIDs, "/")
			for _, p := range pathUIDs {
				if p != "" && p != f.UID {
					parentUIDs = append(parentUIDs, p)
				}
			}

			for _, parentUID := range parentUIDs {
				contains := slices.ContainsFunc(allFolders, func(f *folder.FolderReference) bool {
					return f.UID == parentUID
				})
				if contains {
					isSubfolder = true
					break
				}
			}
		}

		if !isSubfolder {
			foldersDedup = append(foldersDedup, f.ToFolderReference())
		}
	}
	return foldersDedup
}

func (s *Service) deleteChildrenInFolder(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) error {
	ctx, span := s.tracer.Start(ctx, "folder.deleteChildrenInFolder")
	defer span.End()
	for _, v := range s.registry {
		if err := v.DeleteInFolders(ctx, orgID, folderUIDs, user); err != nil {
			return err
		}
	}
	return nil
}

// SplitFullpath splits a string into an array of strings using the FULLPATH_SEPARATOR as the delimiter.
// It handles escape characters by appending the separator and the new string if the current string ends with an escape character.
// The resulting array does not contain empty strings.
func SplitFullpath(s string) []string {
	splitStrings := strings.Split(s, FULLPATH_SEPARATOR)

	result := make([]string, 0)
	current := ""

	for _, str := range splitStrings {
		if strings.HasSuffix(current, "\\") {
			// If the current string ends with an escape character, append the separator and the new string
			current = current[:len(current)-1] + FULLPATH_SEPARATOR + str
		} else {
			// If the current string does not end with an escape character, append the current string to the result and start a new current string
			if current != "" {
				result = append(result, current)
			}
			current = str
		}
	}

	// Append the last string to the result
	if current != "" {
		result = append(result, current)
	}

	return result
}

func toFolderError(err error) error {
	if errors.Is(err, dashboards.ErrDashboardTitleEmpty) {
		return folder.ErrTitleEmpty
	}

	if errors.Is(err, dashboards.ErrDashboardUpdateAccessDenied) {
		return folder.ErrAccessDenied
	}

	if errors.Is(err, dashboards.ErrDashboardWithSameUIDExists) {
		return folder.ErrSameUIDExists
	}

	if errors.Is(err, dashboards.ErrDashboardVersionMismatch) {
		return folder.ErrVersionMismatch
	}

	if errors.Is(err, dashboards.ErrDashboardNotFound) {
		return dashboards.ErrFolderNotFound
	}

	return err
}

func (s *Service) RegisterService(r folder.RegistryService) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.registry[r.Kind()] = r

	return nil
}

func (s *Service) supportBundleCollector() supportbundles.Collector {
	collector := supportbundles.Collector{
		UID:               "folder-stats",
		DisplayName:       "Folder information",
		Description:       "Folder information for the Grafana instance",
		IncludedByDefault: false,
		Default:           true,
		Fn: func(ctx context.Context) (*supportbundles.SupportItem, error) {
			s.log.Info("Generating folder support bundle")
			folders, err := s.GetFolders(ctx, folder.GetFoldersQuery{
				OrgID: 0,
				SignedInUser: &user.SignedInUser{
					Login:            "sa-supportbundle",
					OrgRole:          "Admin",
					IsGrafanaAdmin:   true,
					IsServiceAccount: true,
					Permissions:      map[int64]map[string][]string{accesscontrol.GlobalOrgID: {folder.ActionFoldersRead: {folder.ScopeFoldersAll}}},
				},
			})
			if err != nil {
				return nil, err
			}
			return s.supportItemFromFolders(folders)
		},
	}
	return collector
}

func (s *Service) supportItemFromFolders(folders []*folder.Folder) (*supportbundles.SupportItem, error) {
	stats := struct {
		Total    int              `json:"total"`    // how many folders?
		Depths   map[int]int      `json:"depths"`   // how deep they are?
		Children map[int]int      `json:"children"` // how many child folders they have?
		Folders  []*folder.Folder `json:"folders"`  // what are they?
	}{Total: len(folders), Folders: folders, Children: map[int]int{}, Depths: map[int]int{}}

	// Build parent-child mapping
	parents := map[string]string{}
	children := map[string][]string{}
	for _, f := range folders {
		parents[f.UID] = f.ParentUID
		children[f.ParentUID] = append(children[f.ParentUID], f.UID)
	}
	// Find depths of each folder
	for _, f := range folders {
		depth := 0
		for uid := f.UID; uid != ""; uid = parents[uid] {
			depth++
		}
		stats.Depths[depth] += 1
		stats.Children[len(children[f.UID])] += 1
	}

	b, err := json.MarshalIndent(stats, "", " ")
	if err != nil {
		return nil, err
	}
	return &supportbundles.SupportItem{
		Filename:  "folders.json",
		FileBytes: b,
	}, nil
}
