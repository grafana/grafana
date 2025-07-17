package provisioning

import (
	"context"
	"encoding/binary"
	"fmt"
	"hash"
	"hash/fnv"
	"slices"
	"unsafe"

	"github.com/prometheus/common/model"
	"golang.org/x/exp/maps"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
	"github.com/grafana/grafana/pkg/setting"
)

type NotificationPolicyService struct {
	configStore     alertmanagerConfigStore
	provenanceStore ProvisioningStore
	xact            TransactionManager
	log             log.Logger
	settings        setting.UnifiedAlertingSettings
	validator       validation.ProvenanceStatusTransitionValidator
}

func NewNotificationPolicyService(am alertmanagerConfigStore, prov ProvisioningStore,
	xact TransactionManager, settings setting.UnifiedAlertingSettings, log log.Logger) *NotificationPolicyService {
	return &NotificationPolicyService{
		configStore:     am,
		provenanceStore: prov,
		xact:            xact,
		log:             log,
		settings:        settings,
		validator:       validation.ValidateProvenanceRelaxed,
	}
}

const UserDefinedRoutingTreeName = legacy_storage.UserDefinedRoutingTreeName

func (nps *NotificationPolicyService) GetDefaultSubTree(ctx context.Context, orgID int64) (definitions.Route, string, error) {
	return nps.GetPolicySubTree(ctx, orgID, UserDefinedRoutingTreeName)
}

func (nps *NotificationPolicyService) GetPolicySubTree(ctx context.Context, orgID int64, name string) (definitions.Route, string, error) {
	rev, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.Route{}, "", err
	}

	if name == "" {
		name = UserDefinedRoutingTreeName
	}

	subtree, err := rev.GetNamedRoute(name, nps.log)
	if err != nil {
		return definitions.Route{}, "", err
	}

	provenance, err := nps.provenanceStore.GetProvenance(ctx, subtree, orgID)
	if err != nil {
		return definitions.Route{}, "", err
	}
	subtree.Provenance = definitions.Provenance(provenance)

	return *subtree, calculateRouteFingerprint(*subtree), nil
}

func (nps *NotificationPolicyService) GetPolicySubTrees(ctx context.Context, orgID int64) ([]*definitions.Route, map[string]string, error) {
	rev, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, nil, err
	}

	namedRoutes, err := rev.GetNamedRoutes(nps.log)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to split policy tree: %w", err)
	}

	provenances, err := nps.provenanceStore.GetProvenances(ctx, orgID, (&definitions.Route{}).ResourceType())
	if err != nil {
		return nil, nil, err
	}

	versions := make(map[string]string, len(namedRoutes))
	for _, subTree := range namedRoutes {
		versions[subTree.Name] = calculateRouteFingerprint(*subTree)
		provenance, ok := provenances[subTree.ResourceID()]
		if !ok {
			provenance = models.ProvenanceNone
		}
		subTree.Provenance = definitions.Provenance(provenance)
	}
	return namedRoutes, versions, nil
}

func (nps *NotificationPolicyService) DeletePolicySubTree(ctx context.Context, orgID int64, name string, p models.Provenance, version string) error {
	revision, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	if name == "" {
		name = UserDefinedRoutingTreeName
	}

	existing, err := revision.GetNamedRoute(name, nps.log)
	if err != nil {
		return err
	}
	if existing == nil {
		return ErrRouteNotFound.Errorf("")
	}

	err = nps.checkOptimisticConcurrency(*existing, p, version, "delete")
	if err != nil {
		return err
	}

	storedProvenance, err := nps.provenanceStore.GetProvenance(ctx, existing, orgID)
	if err != nil {
		return err
	}
	if err := nps.validator(storedProvenance, p); err != nil {
		return err
	}

	if name == UserDefinedRoutingTreeName {
		defaultCfg, err := legacy_storage.DeserializeAlertmanagerConfig([]byte(nps.settings.DefaultConfiguration))
		if err != nil {
			nps.log.Error("Failed to parse default alertmanager config: %w", err)
			return fmt.Errorf("failed to parse default alertmanager config: %w", err)
		}

		defaultCfg.AlertmanagerConfig.Route.Name = UserDefinedRoutingTreeName
		_, err = revision.UpdateNamedRoute(*defaultCfg.AlertmanagerConfig.Route, nps.log)
		if err != nil {
			return err
		}
	} else {
		err = revision.DeleteNamedRoute(name)
		if err != nil {
			return fmt.Errorf("failed to delete named route %q: %w", name, err)
		}
	}

	_, err = revision.Config.GetMergedAlertmanagerConfig()
	if err != nil {
		return fmt.Errorf("new routing tree is not compatible with extra configuration: %w", err)
	}

	return nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return nps.provenanceStore.DeleteProvenance(ctx, existing, orgID)
	})
}

func (nps *NotificationPolicyService) CreatePolicySubTree(ctx context.Context, orgID int64, subtree definitions.Route, p models.Provenance) (definitions.Route, string, error) {
	err := subtree.Validate()
	if err != nil {
		return definitions.Route{}, "", MakeErrRouteInvalidFormat(err)
	}

	revision, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.Route{}, "", err
	}

	created, err := revision.CreateNamedRoute(subtree)
	if err != nil {
		return definitions.Route{}, "", err
	}

	_, err = revision.Config.GetMergedAlertmanagerConfig()
	if err != nil {
		return definitions.Route{}, "", fmt.Errorf("new routing tree is not compatible with extra configuration: %w", err)
	}

	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return nps.provenanceStore.SetProvenance(ctx, &created, orgID, p)
	})
	if err != nil {
		return definitions.Route{}, "", err
	}
	return created, calculateRouteFingerprint(created), nil
}

func (nps *NotificationPolicyService) UpdatePolicySubTree(ctx context.Context, orgID int64, subtree definitions.Route, p models.Provenance, version string) (definitions.Route, string, error) {
	err := subtree.Validate()
	if err != nil {
		return definitions.Route{}, "", MakeErrRouteInvalidFormat(err)
	}

	revision, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.Route{}, "", err
	}

	if subtree.Name == "" {
		subtree.Name = UserDefinedRoutingTreeName
	}

	existing, err := revision.GetNamedRoute(subtree.Name, nps.log)
	if err != nil {
		return definitions.Route{}, "", fmt.Errorf("failed to get existing named route %q: %w", subtree.Name, err)
	}

	err = nps.checkOptimisticConcurrency(*existing, p, version, "update")
	if err != nil {
		return definitions.Route{}, "", err
	}

	// check that provenance is not changed in an invalid way
	storedProvenance, err := nps.provenanceStore.GetProvenance(ctx, &subtree, orgID)
	if err != nil {
		return definitions.Route{}, "", err
	}
	if err := nps.validator(storedProvenance, p); err != nil {
		return definitions.Route{}, "", err
	}

	updated, err := revision.UpdateNamedRoute(subtree, nps.log)
	if err != nil {
		return definitions.Route{}, "", err
	}

	_, err = revision.Config.GetMergedAlertmanagerConfig()
	if err != nil {
		return definitions.Route{}, "", fmt.Errorf("new routing tree is not compatible with extra configuration: %w", err)
	}

	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return nps.provenanceStore.SetProvenance(ctx, &updated, orgID, p)
	})
	if err != nil {
		return definitions.Route{}, "", err
	}
	return updated, calculateRouteFingerprint(updated), nil
}

// TODO: Remove this method once the all callers support named routes.
func (nps *NotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, string, error) {
	return nps.GetPolicySubTree(ctx, orgID, legacy_storage.UserDefinedRoutingTreeName)
}

// TODO: Remove this method once the all callers support named routes.
func (nps *NotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p models.Provenance, version string) (definitions.Route, string, error) {
	tree.Name = legacy_storage.UserDefinedRoutingTreeName
	return nps.UpdatePolicySubTree(ctx, orgID, tree, p, version)
}

// TODO: Remove this method once the all callers support named routes.
func (nps *NotificationPolicyService) ResetPolicyTree(ctx context.Context, orgID int64, provenance models.Provenance) (definitions.Route, error) {
	err := nps.DeletePolicySubTree(ctx, orgID, legacy_storage.UserDefinedRoutingTreeName, provenance, "")
	if err != nil {
		return definitions.Route{}, err
	}
	// If the tree was not found, we can just return the default route.
	defaultCfg, err := legacy_storage.DeserializeAlertmanagerConfig([]byte(nps.settings.DefaultConfiguration))
	if err != nil {
		nps.log.Error("Failed to parse default alertmanager config: %w", err)
		return definitions.Route{}, fmt.Errorf("failed to parse default alertmanager config: %w", err)
	}
	route := defaultCfg.AlertmanagerConfig.Route

	return *route, nil
}

func calculateRouteFingerprint(route definitions.Route) string {
	sum := fnv.New64a()
	writeToHash(sum, &route)
	return fmt.Sprintf("%016x", sum.Sum64())
}

func writeToHash(sum hash.Hash, r *definitions.Route) {
	writeBytes := func(b []byte) {
		_, _ = sum.Write(b)
		// add a byte sequence that cannot happen in UTF-8 strings.
		_, _ = sum.Write([]byte{255})
	}
	writeString := func(s string) {
		if len(s) == 0 {
			writeBytes(nil)
			return
		}
		// #nosec G103
		// avoid allocation when converting string to byte slice
		writeBytes(unsafe.Slice(unsafe.StringData(s), len(s)))
	}

	// this temp slice is used to convert ints to bytes.
	tmp := make([]byte, 8)
	writeInt := func(u int64) {
		binary.LittleEndian.PutUint64(tmp, uint64(u))
		writeBytes(tmp)
	}
	writeBool := func(b bool) {
		if b {
			writeInt(1)
		} else {
			writeInt(0)
		}
	}
	writeDuration := func(d *model.Duration) {
		if d == nil {
			_, _ = sum.Write([]byte{255})
		} else {
			binary.LittleEndian.PutUint64(tmp, uint64(*d))
			_, _ = sum.Write(tmp)
			_, _ = sum.Write([]byte{255})
		}
	}

	writeString(r.Name)
	writeString(r.Receiver)
	for _, s := range r.GroupByStr {
		writeString(s)
	}
	for _, labelName := range r.GroupBy {
		writeString(string(labelName))
	}
	writeBool(r.GroupByAll)
	if len(r.Match) > 0 {
		keys := maps.Keys(r.Match)
		slices.Sort(keys)
		for _, key := range keys {
			writeString(key)
			writeString(r.Match[key])
		}
	}
	if len(r.MatchRE) > 0 {
		keys := maps.Keys(r.MatchRE)
		slices.Sort(keys)
		for _, key := range keys {
			writeString(key)
			str, err := r.MatchRE[key].MarshalJSON()
			if err != nil {
				writeString(fmt.Sprintf("%+v", r.MatchRE))
			}
			writeBytes(str)
		}
	}
	for _, matcher := range r.Matchers {
		writeString(matcher.String())
	}
	for _, matcher := range r.ObjectMatchers {
		writeString(matcher.String())
	}
	for _, timeInterval := range r.MuteTimeIntervals {
		writeString(timeInterval)
	}
	for _, timeInterval := range r.ActiveTimeIntervals {
		writeString(timeInterval)
	}
	writeBool(r.Continue)
	writeDuration(r.GroupWait)
	writeDuration(r.GroupInterval)
	writeDuration(r.RepeatInterval)
	writeString(string(r.Provenance))
	for _, route := range r.Routes {
		writeToHash(sum, route)
	}
}

func (nps *NotificationPolicyService) checkOptimisticConcurrency(current definitions.Route, provenance models.Provenance, desiredVersion string, action string) error {
	if desiredVersion == "" {
		if provenance != models.ProvenanceFile {
			// if version is not specified and it's not a file provisioning, emit a log message to reflect that optimistic concurrency is disabled for this request
			nps.log.Debug("ignoring optimistic concurrency check because version was not provided", "operation", action)
		}
		return nil
	}
	currentVersion := calculateRouteFingerprint(current)
	if currentVersion != desiredVersion {
		return ErrVersionConflict.Errorf("provided version %s of routing tree does not match current version %s", desiredVersion, currentVersion)
	}
	return nil
}
