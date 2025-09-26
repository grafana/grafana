package cleanup

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"strconv"
	"time"

	"go.opentelemetry.io/otel/attribute"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/annotations"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/image"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/queryhistory"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/services/team"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/setting"
)

type AlertRuleService interface {
	CleanUpDeletedAlertRules(ctx context.Context) (int64, error)
}

type CleanUpService struct {
	log                       log.Logger
	tracer                    tracing.Tracer
	store                     db.DB
	Cfg                       *setting.Cfg
	Features                  featuremgmt.FeatureToggles
	ServerLockService         *serverlock.ServerLockService
	ShortURLService           shorturls.Service
	QueryHistoryService       queryhistory.Service
	dashboardVersionService   dashver.Service
	dashboardSnapshotService  dashboardsnapshots.Service
	deleteExpiredImageService *image.DeleteExpiredService
	tempUserService           tempuser.Service
	annotationCleaner         annotations.Cleaner
	alertRuleService          AlertRuleService
	clientConfigProvider      grafanaapiserver.RestConfigProvider
	orgService                org.Service
	dataSourceService         datasources.DataSourceService
	teamService               team.Service
}

func ProvideService(cfg *setting.Cfg, Features featuremgmt.FeatureToggles, serverLockService *serverlock.ServerLockService,
	shortURLService shorturls.Service, sqlstore db.DB, queryHistoryService queryhistory.Service,
	dashboardVersionService dashver.Service, dashSnapSvc dashboardsnapshots.Service, deleteExpiredImageService *image.DeleteExpiredService,
	tempUserService tempuser.Service, tracer tracing.Tracer, annotationCleaner annotations.Cleaner, service AlertRuleService, clientConfigProvider grafanaapiserver.RestConfigProvider, orgService org.Service,
	dataSourceService datasources.DataSourceService, teamService team.Service,
) *CleanUpService {
	s := &CleanUpService{
		Cfg:                       cfg,
		Features:                  Features,
		ServerLockService:         serverLockService,
		ShortURLService:           shortURLService,
		QueryHistoryService:       queryHistoryService,
		store:                     sqlstore,
		log:                       log.New("cleanup"),
		dashboardVersionService:   dashboardVersionService,
		dashboardSnapshotService:  dashSnapSvc,
		deleteExpiredImageService: deleteExpiredImageService,
		tempUserService:           tempUserService,
		tracer:                    tracer,
		annotationCleaner:         annotationCleaner,
		alertRuleService:          service,
		clientConfigProvider:      clientConfigProvider,
		orgService:                orgService,
		dataSourceService:         dataSourceService,
		teamService:               teamService,
	}
	return s
}

type cleanUpJob struct {
	name string
	fn   func(context.Context)
}

func (j cleanUpJob) String() string {
	return strconv.Quote(j.name)
}

func (srv *CleanUpService) Run(ctx context.Context) error {
	srv.cleanUpTmpFiles(ctx)

	ticker := time.NewTicker(time.Minute * 10)
	for {
		select {
		case <-ticker.C:
			srv.clean(ctx)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (srv *CleanUpService) clean(ctx context.Context) {
	const timeout = 9 * time.Minute
	start := time.Now()
	ctx, span := srv.tracer.Start(ctx, "cleanup background job")
	defer span.End()
	ctx, cancelFn := context.WithTimeout(ctx, timeout)
	defer cancelFn()

	cleanupJobs := []cleanUpJob{
		{"clean up temporary files", srv.cleanUpTmpFiles},
		{"delete expired snapshots", srv.deleteExpiredSnapshots},
		{"delete expired dashboard versions", srv.deleteExpiredDashboardVersions},
		{"delete expired images", srv.deleteExpiredImages},
		{"cleanup old annotations", srv.cleanUpOldAnnotations},
		{"expire old user invites", srv.expireOldUserInvites},
		{"delete stale query history", srv.deleteStaleQueryHistory},
		{"expire old email verifications", srv.expireOldVerifications},
		{"cleanup stale team lbac rules", srv.cleanupStaleLBACRules},
	}

	if srv.Cfg.ShortLinkExpiration > 0 {
		cleanupJobs = append(cleanupJobs, cleanUpJob{"delete stale short URLs", srv.deleteStaleShortURLs})
	}

	if srv.Cfg.UnifiedAlerting.DeletedRuleRetention > 0 {
		cleanupJobs = append(cleanupJobs, cleanUpJob{"cleanup trash alert rules", srv.cleanUpTrashAlertRules})
	}

	logger := srv.log.FromContext(ctx)
	logger.Debug("Starting cleanup jobs", "jobs", fmt.Sprintf("%v", cleanupJobs))

	for _, j := range cleanupJobs {
		if ctx.Err() != nil {
			logger.Error("Cancelled cleanup job", "error", ctx.Err(), "duration", time.Since(start))
			return
		}
		ctx, span := srv.tracer.Start(ctx, j.name)
		j.fn(ctx)
		span.End()
	}

	logger.Info("Completed cleanup jobs", "duration", time.Since(start))
}

func (srv *CleanUpService) cleanUpOldAnnotations(ctx context.Context) {
	logger := srv.log.FromContext(ctx)
	affected, affectedTags, err := srv.annotationCleaner.Run(ctx, srv.Cfg)
	if err != nil && !errors.Is(err, context.DeadlineExceeded) {
		logger.Error("failed to clean up old annotations", "error", err)
	} else {
		logger.Debug("Deleted excess annotations", "annotations affected", affected, "annotation tags affected", affectedTags)
	}
}

func (srv *CleanUpService) cleanUpTmpFiles(ctx context.Context) {
	folders := []string{
		srv.Cfg.ImagesDir,
		srv.Cfg.CSVsDir,
		srv.Cfg.PDFsDir,
	}

	for _, f := range folders {
		ctx, span := srv.tracer.Start(ctx, "delete stale files in temporary directory")
		span.SetAttributes(attribute.String("directory", f))
		srv.cleanUpTmpFolder(ctx, f)
		span.End()
	}
}

func (srv *CleanUpService) cleanUpTmpFolder(ctx context.Context, folder string) {
	logger := srv.log.FromContext(ctx)
	if _, err := os.Stat(folder); os.IsNotExist(err) {
		return
	}

	files, err := os.ReadDir(folder)
	if err != nil {
		logger.Error("Problem reading dir", "folder", folder, "error", err)
		return
	}

	var toDelete []fs.DirEntry
	var now = time.Now()

	for _, file := range files {
		info, err := file.Info()
		if err != nil {
			logger.Error("Problem reading file", "folder", folder, "file", file, "error", err)
			continue
		}

		if srv.shouldCleanupTempFile(info.ModTime(), now) {
			toDelete = append(toDelete, file)
		}
	}

	for _, file := range toDelete {
		fullPath := path.Join(folder, file.Name())
		err := os.Remove(fullPath)
		if err != nil {
			logger.Error("Failed to delete temp file", "file", file.Name(), "error", err)
		}
	}

	logger.Debug("Found old rendered file to delete", "folder", folder, "deleted", len(toDelete), "kept", len(files))
}

func (srv *CleanUpService) shouldCleanupTempFile(filemtime time.Time, now time.Time) bool {
	if srv.Cfg.TempDataLifetime == 0 {
		return false
	}

	return filemtime.Add(srv.Cfg.TempDataLifetime).Before(now)
}

func (srv *CleanUpService) deleteExpiredSnapshots(ctx context.Context) {
	logger := srv.log.FromContext(ctx)
	cmd := dashboardsnapshots.DeleteExpiredSnapshotsCommand{}
	if err := srv.dashboardSnapshotService.DeleteExpiredSnapshots(ctx, &cmd); err != nil {
		logger.Error("Failed to delete expired snapshots", "error", err.Error())
	} else {
		logger.Debug("Deleted expired snapshots", "rows affected", cmd.DeletedRows)
	}
}

func (srv *CleanUpService) deleteExpiredDashboardVersions(ctx context.Context) {
	logger := srv.log.FromContext(ctx)
	cmd := dashver.DeleteExpiredVersionsCommand{}
	if err := srv.dashboardVersionService.DeleteExpired(ctx, &cmd); err != nil {
		logger.Error("Failed to delete expired dashboard versions", "error", err.Error())
	} else {
		logger.Debug("Deleted old/expired dashboard versions", "rows affected", cmd.DeletedRows)
	}
}

func (srv *CleanUpService) deleteExpiredImages(ctx context.Context) {
	logger := srv.log.FromContext(ctx)
	if !srv.Cfg.UnifiedAlerting.IsEnabled() {
		return
	}
	if rowsAffected, err := srv.deleteExpiredImageService.DeleteExpired(ctx); err != nil {
		logger.Error("Failed to delete expired images", "error", err.Error())
	} else {
		logger.Debug("Deleted expired images", "rows affected", rowsAffected)
	}
}

func (srv *CleanUpService) expireOldUserInvites(ctx context.Context) {
	logger := srv.log.FromContext(ctx)
	maxInviteLifetime := srv.Cfg.UserInviteMaxLifetime

	cmd := tempuser.ExpireTempUsersCommand{
		OlderThan: time.Now().Add(-maxInviteLifetime),
	}

	if err := srv.tempUserService.ExpireOldUserInvites(ctx, &cmd); err != nil {
		logger.Error("Problem expiring user invites", "error", err.Error())
	} else {
		logger.Debug("Expired user invites", "rows affected", cmd.NumExpired)
	}
}

func (srv *CleanUpService) expireOldVerifications(ctx context.Context) {
	logger := srv.log.FromContext(ctx)
	maxVerificationLifetime := srv.Cfg.VerificationEmailMaxLifetime

	cmd := tempuser.ExpireTempUsersCommand{
		OlderThan: time.Now().Add(-maxVerificationLifetime),
	}

	if err := srv.tempUserService.ExpireOldVerifications(ctx, &cmd); err != nil {
		logger.Error("Problem expiring email verifications", "error", err.Error())
	} else {
		logger.Debug("Expired email verifications", "rows affected", cmd.NumExpired)
	}
}

func (srv *CleanUpService) deleteStaleShortURLs(ctx context.Context) {
	logger := srv.log.FromContext(ctx)
	if srv.Features.IsEnabledGlobally(featuremgmt.FlagKubernetesShortURLs) {
		srv.deleteStaleKubernetesShortURLs(ctx)
	} else {
		cmd := shorturls.DeleteShortUrlCommand{
			OlderThan: time.Now().Add(-time.Duration(srv.Cfg.ShortLinkExpiration*24) * time.Hour),
		}
		if err := srv.ShortURLService.DeleteStaleShortURLs(ctx, &cmd); err != nil {
			logger.Error("Problem deleting stale short urls", "error", err.Error())
		} else {
			logger.Debug("Deleted short urls", "rows affected", cmd.NumDeleted)
		}
	}
}

func (srv *CleanUpService) deleteStaleKubernetesShortURLs(ctx context.Context) {
	logger := srv.log.FromContext(ctx)
	logger.Debug("Starting deleting expired Kubernetes shortURLs")

	// Create the dynamic client for Kubernetes API
	restConfig, err := srv.clientConfigProvider.GetRestConfig(ctx)
	if err != nil {
		logger.Error("Failed to get REST config for Kubernetes client", "error", err.Error())
		return
	}

	client, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		logger.Error("Failed to create Kubernetes client", "error", err.Error())
		return
	}

	// Set up the GroupVersionResource for shortURLs
	gvr := schema.GroupVersionResource{
		Group:    v1alpha1.ShortURLKind().Group(),
		Version:  v1alpha1.ShortURLKind().Version(),
		Resource: v1alpha1.ShortURLKind().Plural(),
	}

	// Calculate the expiration time
	expirationTime := time.Now().Add(-time.Duration(srv.Cfg.ShortLinkExpiration*24) * time.Hour)
	expirationTimestamp := expirationTime.Unix()
	deletedCount := 0

	// List and delete expired shortURLs across all namespaces
	orgs, err := srv.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		logger.Error("Failed to list organizations", "error", err.Error())
		return
	}

	for _, o := range orgs {
		ctx, _ := identity.WithServiceIdentity(ctx, o.ID)
		namespaceMapper := request.GetNamespaceMapper(srv.Cfg)
		shortURLs, err := client.Resource(gvr).Namespace(namespaceMapper(o.ID)).List(ctx, v1.ListOptions{})
		if err != nil {
			logger.Error("Failed to list shortURLs", "error", err.Error())
			return
		}
		// Check each shortURL for expiration
		for _, item := range shortURLs.Items {
			// Convert unstructured object to ShortURL struct
			var shortURL v1alpha1.ShortURL
			err := runtime.DefaultUnstructuredConverter.FromUnstructured(item.Object, &shortURL)
			if err != nil {
				logger.Error("Failed to convert unstructured object to ShortURL", "name", item.GetName(), "namespace", item.GetNamespace(), "error", err.Error())
				continue
			}

			// Only delete if lastSeenAt is 0 (meaning it has not been accessed) and the creation time is older than the expiration time
			if shortURL.Status.LastSeenAt == 0 && shortURL.CreationTimestamp.Unix() < expirationTimestamp {
				namespace := shortURL.Namespace
				name := shortURL.Name

				err := client.Resource(gvr).Namespace(namespace).Delete(ctx, name, v1.DeleteOptions{})
				if err != nil {
					// Check if it's a "not found" error, which is expected if the resource was already deleted
					if k8serrors.IsNotFound(err) {
						logger.Debug("ShortURL already deleted", "name", name, "namespace", namespace)
					} else {
						logger.Error("Failed to delete expired shortURL", "name", name, "namespace", namespace, "error", err.Error())
					}
				} else {
					deletedCount++
					logger.Debug("Successfully deleted expired shortURL", "name", name, "namespace", namespace, "creationTime", shortURL.CreationTimestamp.Unix(), "expirationTime", expirationTimestamp)
				}
			}
		}
	}

	logger.Debug("Deleted expired Kubernetes shortURLs", "count", deletedCount)
}

func (srv *CleanUpService) deleteStaleQueryHistory(ctx context.Context) {
	logger := srv.log.FromContext(ctx)
	// Delete query history from 14+ days ago with exception of starred queries
	maxQueryHistoryLifetime := time.Hour * 24 * 14
	olderThan := time.Now().Add(-maxQueryHistoryLifetime).Unix()
	rowsCount, err := srv.QueryHistoryService.DeleteStaleQueriesInQueryHistory(ctx, olderThan)
	if err != nil {
		logger.Error("Problem deleting stale query history", "error", err.Error())
	} else {
		logger.Debug("Deleted stale query history", "rows affected", rowsCount)
	}

	// Enforce 200k limit for query_history table
	queryHistoryLimit := 200000
	rowsCount, err = srv.QueryHistoryService.EnforceRowLimitInQueryHistory(ctx, queryHistoryLimit, false)
	if err != nil {
		logger.Error("Problem with enforcing row limit for query_history", "error", err.Error())
	} else {
		logger.Debug("Enforced row limit for query_history", "rows affected", rowsCount)
	}

	// Enforce 150k limit for query_history_star table
	queryHistoryStarLimit := 150000
	rowsCount, err = srv.QueryHistoryService.EnforceRowLimitInQueryHistory(ctx, queryHistoryStarLimit, true)
	if err != nil {
		logger.Error("Problem with enforcing row limit for query_history_star", "error", err.Error())
	} else {
		logger.Debug("Enforced row limit for query_history_star", "rows affected", rowsCount)
	}
}

func (srv *CleanUpService) cleanUpTrashAlertRules(ctx context.Context) {
	logger := srv.log.FromContext(ctx)
	affected, err := srv.alertRuleService.CleanUpDeletedAlertRules(ctx)
	if err != nil {
		logger.Error("Problem cleaning up deleted alert rules", "error", err)
	} else {
		logger.Debug("Cleaned up deleted alert rules", "rows affected", affected)
	}
}

// cleanupStaleLBACRules exists to clean up lbac rules that are stale from teams getting deleted as we do not have
// cascading deletions on teams to delete existing lbac rules
func (srv *CleanUpService) cleanupStaleLBACRules(ctx context.Context) {
	logger := srv.log.FromContext(ctx)

	// Get all datasources
	allDataSources, err := srv.dataSourceService.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{})
	if err != nil {
		logger.Error("Failed to get datasources for LBAC cleanup", "error", err)
		return
	}

	var totalCleaned int
	var totalDataSources int

	for _, ds := range allDataSources {
		if ds.JsonData == nil {
			continue
		}

		// Check if datasource has team LBAC rules
		teamHTTPHeaders, err := datasources.GetTeamHTTPHeaders(ds.JsonData)
		if err != nil || teamHTTPHeaders == nil {
			continue
		}

		totalDataSources++

		// Extract team UIDs and check if teams still exist
		cleanedRules, removedCount := srv.getLBACRulesForTeamsStillExisting(ctx, teamHTTPHeaders, ds.OrgID)

		if removedCount > 0 {
			// Update the datasource with cleaned rules
			err := srv.updateDataSourceLBACRules(ctx, ds, cleanedRules)
			if err != nil {
				logger.Error("Failed to update datasource LBAC rules",
					"datasource", ds.UID, "error", err)
			} else {
				totalCleaned += removedCount
				logger.Debug("Cleaned stale LBAC rules",
					"datasource", ds.UID, "removed", removedCount)
			}
		}
	}

	if totalCleaned > 0 {
		logger.Info("Cleaned up stale team LBAC rules",
			"datasources_processed", totalDataSources,
			"total_rules_removed", totalCleaned)
	}
}

func (srv *CleanUpService) getLBACRulesForTeamsStillExisting(ctx context.Context, teamHeaders *datasources.TeamHTTPHeaders, orgID int64) (*datasources.TeamHTTPHeaders, int) {
	logger := srv.log.FromContext(ctx)
	cleanedHeaders := &datasources.TeamHTTPHeaders{Headers: make(map[string][]datasources.TeamHTTPHeader)}
	removedCount := 0

	for teamIdentifier, headers := range teamHeaders.Headers {
		// Determine if this is a UID or ID
		var teamUID string
		teamID, err := strconv.ParseInt(teamIdentifier, 10, 64)

		if err != nil {
			// It's a UID
			teamUID = teamIdentifier
		} else {
			// It's an ID, need to resolve to UID
			teamByID, err := srv.teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{
				OrgID: orgID,
				ID:    teamID,
			})
			if err != nil {
				logger.Debug("Team ID no longer exists, removing LBAC rules",
					"teamID", teamIdentifier, "orgID", orgID)
				removedCount++
				continue
			}
			teamUID = teamByID.UID
		}

		// Check if team still exists by UID
		_, err = srv.teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{
			OrgID: orgID,
			UID:   teamUID,
		})

		if err != nil {
			logger.Debug("Team UID no longer exists, removing LBAC rules",
				"teamUID", teamUID, "orgID", orgID)
			removedCount++
			continue
		}

		// Team exists, keep the rules
		cleanedHeaders.Headers[teamIdentifier] = headers
	}

	return cleanedHeaders, removedCount
}

func (srv *CleanUpService) updateDataSourceLBACRules(ctx context.Context, ds *datasources.DataSource, cleanedHeaders *datasources.TeamHTTPHeaders) error {
	// Update JsonData with cleaned rules
	jsonData := ds.JsonData
	jsonData.Set("teamHttpHeaders", cleanedHeaders)

	updateCmd := &datasources.UpdateDataSourceCommand{
		ID:                   ds.ID,
		OrgID:                ds.OrgID,
		UID:                  ds.UID,
		Name:                 ds.Name,
		Type:                 ds.Type,
		Access:               ds.Access,
		URL:                  ds.URL,
		User:                 ds.User,
		Database:             ds.Database,
		BasicAuth:            ds.BasicAuth,
		BasicAuthUser:        ds.BasicAuthUser,
		WithCredentials:      ds.WithCredentials,
		IsDefault:            ds.IsDefault,
		JsonData:             jsonData,
		AllowLBACRuleUpdates: true, // Critical: Allow LBAC rule updates
		Version:              ds.Version,
		ReadOnly:             ds.ReadOnly,
		APIVersion:           ds.APIVersion,
	}

	_, err := srv.dataSourceService.UpdateDataSource(ctx, updateCmd)
	return err
}
