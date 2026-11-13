package dashboard

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/validate/content"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/folder"
)

const (
	dashboardPreferencesMergedFolderParam      = "folder"
	dashboardPreferencesMergedIncludeUserParam = "includeUser"
)

// Every field a tier can set or reset. TestDashboardPreferencesFieldPathsMatchSchema keeps it in step with the
// schema's reset paths.
var dashboardPreferencesFieldPaths = []dashv2beta1.DashboardPreferencesResetPath{
	dashv2beta1.DashboardPreferencesResetPathDashboardPreload,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoRefresh,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoRefreshIntervals,
	dashv2beta1.DashboardPreferencesResetPathDashboardTimeRange,
	dashv2beta1.DashboardPreferencesResetPathDashboardFiscalYearStartMonth,
	dashv2beta1.DashboardPreferencesResetPathDashboardNowDelay,
	dashv2beta1.DashboardPreferencesResetPathDashboardHideTimepicker,
	dashv2beta1.DashboardPreferencesResetPathDashboardCursorSync,
	dashv2beta1.DashboardPreferencesResetPathDashboardLayout,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoGridMaxColumnCount,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoGridColumnWidthMode,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoGridColumnWidth,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoGridRowHeightMode,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoGridRowHeight,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoGridFillScreen,
	dashv2beta1.DashboardPreferencesResetPathPanelsLegendShowLegend,
	dashv2beta1.DashboardPreferencesResetPathPanelsLegendPlacement,
	dashv2beta1.DashboardPreferencesResetPathPanelsLegendDisplayMode,
	dashv2beta1.DashboardPreferencesResetPathPanelsTooltipMode,
	dashv2beta1.DashboardPreferencesResetPathPanelsTooltipSort,
	dashv2beta1.DashboardPreferencesResetPathPanelsTooltipHideZeros,
	dashv2beta1.DashboardPreferencesResetPathPanelsAxisAxisPlacement,
	dashv2beta1.DashboardPreferencesResetPathPanelsAxisAxisGridShow,
	dashv2beta1.DashboardPreferencesResetPathPanelsAxisAxisBorderShow,
	dashv2beta1.DashboardPreferencesResetPathPanelsAxisAxisCenteredZero,
	dashv2beta1.DashboardPreferencesResetPathPanelsAxisScale,
	dashv2beta1.DashboardPreferencesResetPathPanelsGraphLineInterpolation,
	dashv2beta1.DashboardPreferencesResetPathPanelsGraphLineWidth,
	dashv2beta1.DashboardPreferencesResetPathPanelsGraphFillOpacity,
	dashv2beta1.DashboardPreferencesResetPathPanelsGraphGradientMode,
	dashv2beta1.DashboardPreferencesResetPathPanelsGraphShowPoints,
	dashv2beta1.DashboardPreferencesResetPathPanelsGraphPointSize,
	dashv2beta1.DashboardPreferencesResetPathPanelsFieldDecimals,
	dashv2beta1.DashboardPreferencesResetPathPanelsFrameTransparent,
}

// dashboardPreferencesMergeTier is one stored tier, in the order a merge consults them.
type dashboardPreferencesMergeTier struct {
	tier dashboardPreferencesTier
	// Left out of sources when empty.
	name string
	spec dashv2beta1.DashboardPreferencesSpec
}

// tiers are in descending priority. Each field comes from the first tier that sets or resets it, where set means
// what it means to admission: the field is present in the encoded spec.
func mergeDashboardPreferences(tiers []dashboardPreferencesMergeTier) (*dashv2beta1.DashboardPreferencesMerged, error) {
	encoded := make([]any, len(tiers))
	for i, t := range tiers {
		spec := t.spec
		spec.Reset = nil
		raw, err := json.Marshal(spec)
		if err != nil {
			return nil, fmt.Errorf("error marshaling dashboard preferences spec: %w", err)
		}
		// Numbers stay json.Number, so an integer is written back exactly.
		decoder := json.NewDecoder(bytes.NewReader(raw))
		decoder.UseNumber()
		if err = decoder.Decode(&encoded[i]); err != nil {
			return nil, fmt.Errorf("error decoding dashboard preferences spec: %w", err)
		}
	}

	values := map[string]any{}
	sources := map[string]dashv2beta1.DashboardPreferencesMergedSource{}
	for _, path := range dashboardPreferencesFieldPaths {
		for i, t := range tiers {
			reset := slices.Contains(t.spec.Reset, path)
			value, set := dashboardPreferencesFieldValue(encoded[i], string(path))
			if !reset && !set {
				continue
			}
			// Validation keeps a tier from both setting and resetting a field. If a stored tier does both,
			// the reset wins, because a reset field is absent from the merged spec.
			if !reset {
				setDashboardPreferencesField(values, string(path), value)
			}
			sources[string(path)] = dashv2beta1.DashboardPreferencesMergedSource{
				Tier:  dashv2beta1.DashboardPreferencesMergedTier(t.tier),
				Name:  t.name,
				Reset: reset,
			}
			break
		}
	}

	merged := &dashv2beta1.DashboardPreferencesMerged{
		TypeMeta: metav1.TypeMeta{APIVersion: dashv2beta1.APIVERSION, Kind: dashv2beta1.DashboardPreferencesMergedKind},
		Sources:  sources,
	}
	raw, err := json.Marshal(values)
	if err != nil {
		return nil, fmt.Errorf("error marshaling merged dashboard preferences spec: %w", err)
	}
	if err = json.Unmarshal(raw, &merged.Spec); err != nil {
		return nil, fmt.Errorf("error decoding merged dashboard preferences spec: %w", err)
	}
	return merged, nil
}

// setDashboardPreferencesField creates parent objects only when it writes, so a field that no tier sets leaves no
// empty object behind.
func setDashboardPreferencesField(values map[string]any, path string, value any) {
	keys := strings.Split(path, ".")
	obj := values
	for _, key := range keys[:len(keys)-1] {
		child, ok := obj[key].(map[string]any)
		if !ok {
			child = map[string]any{}
			obj[key] = child
		}
		obj = child
	}
	obj[keys[len(keys)-1]] = value
}

// mergedFolders returns the folder and its ancestors, nearest first, or nothing for the top level.
func (s *dashboardPreferencesStorage) mergedFolders(ctx context.Context, requester identity.Requester, nsInfo authlib.NamespaceInfo, folderUID string) ([]string, error) {
	// The top level has only the org tier, whose read rule the authorizer already applied.
	if folder.IsRootFolderUID(folderUID) {
		return nil, nil
	}
	// The dynamic client refuses . and .. as names before sending anything, although tier names allow them.
	if _, ok := dashboardPreferencesScopeFromName(dashv2beta1.DashboardPreferencesFolderName(folderUID)); !ok || len(content.IsPathSegmentName(folderUID)) > 0 {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("folder %q can't hold dashboards", folderUID))
	}

	// Checked before anything reads the folder, so a caller who can't read it can't tell whether it exists.
	allowed, err := checkDashboardPreferencesFolderAccess(ctx, s.accessClient, requester, nsInfo.Value, folderUID, utils.VerbGet)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, apierrors.NewForbidden(folders.FolderResourceInfo.GroupResource(), folderUID, folder.ErrAccessDenied)
	}

	if s.folders == nil {
		return nil, fmt.Errorf("folder client provider is not configured")
	}
	folderClient := s.folders.GetOrCreateHandler(nsInfo.Value)
	if folderClient == nil {
		return nil, fmt.Errorf("folder client handler is not configured for namespace %q", nsInfo.Value)
	}
	// Parent folders apply whether or not the caller can read them, so everyone creating in a folder starts
	// from the same values. Only these folder reads are elevated. The org is the namespace's:
	// WithServiceIdentityForSingleNamespace claims org 1 in every org.
	svcCtx := identity.WithServiceIdentityContext(ctx, nsInfo.OrgID, func(id *identity.StaticRequester) { id.Namespace = nsInfo.Value })

	foldersGR := folders.FolderResourceInfo.GroupResource()
	obj, err := folderClient.Get(svcCtx, folderUID, nsInfo.OrgID, metav1.GetOptions{}, "parents")
	if isNotFoundForObject(err, foldersGR, folderUID) {
		return nil, apierrors.NewNotFound(foldersGR, folderUID)
	}
	if err != nil {
		return nil, dashboardPreferencesAncestryError(ctx, nsInfo.Value, folderUID, err)
	}

	var list folders.FolderInfoList
	if err = runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &list); err != nil {
		return nil, dashboardPreferencesAncestryError(ctx, nsInfo.Value, folderUID, fmt.Errorf("error decoding folder parents: %w", err))
	}
	items := list.Items
	if len(items) == 0 || items[len(items)-1].Name != folderUID {
		return nil, dashboardPreferencesAncestryError(ctx, nsInfo.Value, folderUID, errors.New("folder parents don't end with the folder"))
	}

	// The folder API ends the walk at a parent it couldn't read, for any error. Reading it again tells a missing
	// parent, where the ancestry ends, from a failure that would drop the rest of it.
	if items[0].Detached {
		_, err = folderClient.Get(svcCtx, items[0].Name, nsInfo.OrgID, metav1.GetOptions{})
		if !isNotFoundForObject(err, foldersGR, items[0].Name) {
			if err == nil {
				err = fmt.Errorf("detached parent folder %q was read on a second attempt", items[0].Name)
			} else {
				err = fmt.Errorf("error reading detached parent folder %q: %w", items[0].Name, err)
			}
			return nil, dashboardPreferencesAncestryError(ctx, nsInfo.Value, folderUID, err)
		}
		items = items[1:]
	}

	folderUIDs := make([]string, 0, len(items))
	for _, item := range slices.Backward(items) {
		folderUIDs = append(folderUIDs, item.Name)
	}
	return folderUIDs, nil
}

// The apiserver sends an error's text to the client, so the folder API's message stays in the log. A refusal of
// the service identity is not a 403, because the caller can read the folder, and walking as the caller would
// silently leave out the parents it can't read.
func dashboardPreferencesAncestryError(ctx context.Context, namespace, folderUID string, err error) error {
	logging.FromContext(ctx).Error("dashboard preferences failed to read folder ancestry",
		"namespace", namespace, "folder", folderUID, "err", err)
	return apierrors.NewInternalError(errors.New("folder ancestry could not be read"))
}
