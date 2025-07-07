package provisioning

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"hash"
	"hash/fnv"
	"slices"
	"unsafe"

	"github.com/grafana/alerting/definition"
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

func (nps *NotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, string, error) {
	rev, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.Route{}, "", err
	}

	if rev.Config.AlertmanagerConfig.Route == nil {
		return definitions.Route{}, "", fmt.Errorf("no route present in current alertmanager config")
	}

	provenance, err := nps.provenanceStore.GetProvenance(ctx, rev.Config.AlertmanagerConfig.Route, orgID)
	if err != nil {
		return definitions.Route{}, "", err
	}
	result := *rev.Config.AlertmanagerConfig.Route
	result.Provenance = definitions.Provenance(provenance)
	version := calculateRouteFingerprint(result)
	return result, version, nil
}

func (nps *NotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p models.Provenance, version string) (definitions.Route, string, error) {
	err := tree.Validate()
	if err != nil {
		return definitions.Route{}, "", MakeErrRouteInvalidFormat(err)
	}

	revision, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.Route{}, "", err
	}

	err = nps.checkOptimisticConcurrency(*revision.Config.AlertmanagerConfig.Route, p, version, "update")
	if err != nil {
		return definitions.Route{}, "", err
	}

	// check that provenance is not changed in an invalid way
	storedProvenance, err := nps.provenanceStore.GetProvenance(ctx, &tree, orgID)
	if err != nil {
		return definitions.Route{}, "", err
	}
	if err := nps.validator(storedProvenance, p); err != nil {
		return definitions.Route{}, "", err
	}

	receivers := map[string]struct{}{}
	receivers[""] = struct{}{} // Allow empty receiver (inheriting from parent)
	for _, receiver := range revision.GetReceivers(nil) {
		receivers[receiver.Name] = struct{}{}
	}

	err = tree.ValidateReceivers(receivers)
	if err != nil {
		return definitions.Route{}, "", MakeErrRouteInvalidFormat(err)
	}

	timeIntervals := map[string]struct{}{}
	for _, mt := range revision.Config.AlertmanagerConfig.MuteTimeIntervals {
		timeIntervals[mt.Name] = struct{}{}
	}
	for _, mt := range revision.Config.AlertmanagerConfig.TimeIntervals {
		timeIntervals[mt.Name] = struct{}{}
	}
	err = tree.ValidateTimeIntervals(timeIntervals)
	if err != nil {
		return definitions.Route{}, "", MakeErrRouteInvalidFormat(err)
	}

	revision.Config.AlertmanagerConfig.Route = &tree

	_, err = revision.Config.GetMergedAlertmanagerConfig()
	if err != nil {
		if errors.Is(err, definition.ErrSubtreeMatchersConflict) {
			// TODO temporarily get the conflicting matchers
			return definitions.Route{}, "", MakeErrRouteConflictingMatchers(fmt.Sprintf("%s", revision.Config.ExtraConfigs[0].MergeMatchers))
		}
		nps.log.Warn("Unable to validate the combined routing tree because of an error during merging. This could be a sign of broken external configuration. Skipping", "error", err)
	}

	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return nps.provenanceStore.SetProvenance(ctx, &tree, orgID, p)
	})
	if err != nil {
		return definitions.Route{}, "", err
	}
	return tree, calculateRouteFingerprint(tree), nil
}

func (nps *NotificationPolicyService) ResetPolicyTree(ctx context.Context, orgID int64, provenance models.Provenance) (definitions.Route, error) {
	storedProvenance, err := nps.provenanceStore.GetProvenance(ctx, &definitions.Route{}, orgID)
	if err != nil {
		return definitions.Route{}, err
	}
	if err := nps.validator(storedProvenance, provenance); err != nil {
		return definitions.Route{}, err
	}

	defaultCfg, err := legacy_storage.DeserializeAlertmanagerConfig([]byte(nps.settings.DefaultConfiguration))
	if err != nil {
		nps.log.Error("Failed to parse default alertmanager config: %w", err)
		return definitions.Route{}, fmt.Errorf("failed to parse default alertmanager config: %w", err)
	}
	route := defaultCfg.AlertmanagerConfig.Route

	revision, err := nps.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.Route{}, err
	}
	revision.Config.AlertmanagerConfig.Route = route
	err = nps.ensureDefaultReceiverExists(revision.Config, defaultCfg)
	if err != nil {
		return definitions.Route{}, err
	}

	err = nps.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := nps.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return nps.provenanceStore.DeleteProvenance(ctx, route, orgID)
	})

	if err != nil {
		return definitions.Route{}, nil
	} // TODO should be error?

	return *route, nil
}

func (nps *NotificationPolicyService) ensureDefaultReceiverExists(cfg *definitions.PostableUserConfig, defaultCfg *definitions.PostableUserConfig) error {
	defaultRcv := cfg.AlertmanagerConfig.Route.Receiver

	for _, rcv := range cfg.AlertmanagerConfig.Receivers {
		if rcv.Name == defaultRcv {
			return nil
		}
	}

	for _, rcv := range defaultCfg.AlertmanagerConfig.Receivers {
		if rcv.Name == defaultRcv {
			cfg.AlertmanagerConfig.Receivers = append(cfg.AlertmanagerConfig.Receivers, rcv)
			return nil
		}
	}

	nps.log.Error("Grafana Alerting has been configured with a default configuration that is internally inconsistent! The default configuration's notification policy must have a corresponding receiver.")
	return fmt.Errorf("inconsistent default configuration")
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
