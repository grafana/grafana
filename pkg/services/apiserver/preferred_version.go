package apiserver

import (
	"fmt"
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	serverstorage "k8s.io/apiserver/pkg/server/storage"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// applyPreferredAPIVersions reorders scheme version priority when
// [grafana-apiserver] preferred_api_version lists group/version entries.
// Only applies when the preferred GroupVersion is present in the scheme and
// enabled in apiResourceConfig (see ResourceEnabled for the empty resource).
func applyPreferredAPIVersions(logger log.Logger, cfg *setting.Cfg, scheme *runtime.Scheme, apiResourceConfig *serverstorage.ResourceConfig) error {
	raw := strings.TrimSpace(cfg.SectionWithEnvOverrides("grafana-apiserver").Key("preferred_api_version").String())
	if raw == "" {
		return nil
	}

	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		gv, err := ParseGroupVersionSetting(part)
		if err != nil {
			return err
		}
		if err := ApplyPreferredForGroup(logger, scheme, apiResourceConfig, gv); err != nil {
			return err
		}
	}
	return nil
}

// ParseGroupVersionSetting parses a "group/version" string (e.g.
// "dashboard.grafana.app/v1") into a GroupVersion. It requires both
// group and version to be present and non-empty.
func ParseGroupVersionSetting(s string) (schema.GroupVersion, error) {
	parts := strings.Split(s, "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return schema.GroupVersion{}, fmt.Errorf(
			"invalid preferred_api_version entry %q (expected format is group/version, e.g. dashboard.grafana.app/v1)", s)
	}
	return schema.GroupVersion{Group: parts[0], Version: parts[1]}, nil
}

// ApplyPreferredForGroup reorders the scheme's version priority for a single
// API group so that preferred comes first. It validates that the version is
// registered in the scheme and (when apiResourceConfig is non-nil) enabled.
// The function is a no-op when the version is unknown or disabled.
func ApplyPreferredForGroup(logger log.Logger, scheme *runtime.Scheme, apiResourceConfig *serverstorage.ResourceConfig, preferred schema.GroupVersion) error {
	group := preferred.Group
	pvs := scheme.PrioritizedVersionsForGroup(group)
	if len(pvs) == 0 {
		logger.Info("preferred_api_version: unknown API group, skipping", "group", group)
		return nil
	}

	found := false
	for _, gv := range pvs {
		if gv == preferred {
			found = true
			break
		}
	}
	if !found {
		logger.Info("preferred_api_version: version not registered for group, skipping",
			"group", group, "version", preferred.Version)
		return nil
	}

	if apiResourceConfig != nil {
		gvr := preferred.WithResource("")
		if !apiResourceConfig.ResourceEnabled(gvr) {
			logger.Info("preferred_api_version: version is not enabled, skipping",
				"groupVersion", preferred.String())
			return nil
		}
	}

	// preserve relative order of non-preferred versions.
	reordered := make([]schema.GroupVersion, 0, len(pvs))
	reordered = append(reordered, preferred)
	for _, gv := range pvs {
		if gv == preferred {
			continue
		}
		reordered = append(reordered, gv)
	}

	if err := scheme.SetVersionPriority(reordered...); err != nil {
		return fmt.Errorf("preferred_api_version for %s: %w", group, err)
	}
	logger.Info("set preferred API version for group", "group", group, "preferredVersion", preferred.Version)
	return nil
}

// ReorderGroupVersionsForLegacyCodec reorders the slice passed to
// serializer.CodecFactory.LegacyCodec(...) so that each preferred version is
// first within its group, which determines what is stored in unified storage.
func ReorderGroupVersionsForLegacyCodec(logger log.Logger, cfg *setting.Cfg, scheme *runtime.Scheme, groupVersions []schema.GroupVersion) ([]schema.GroupVersion, error) {
	raw := strings.TrimSpace(cfg.SectionWithEnvOverrides("grafana-apiserver").Key("preferred_api_version").String())
	if raw == "" {
		return groupVersions, nil
	}

	out := slices.Clone(groupVersions)
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		gv, err := ParseGroupVersionSetting(part)
		if err != nil {
			return nil, err
		}

		prefIdx := slices.Index(out, gv)
		if prefIdx < 0 {
			logger.Info("preferred_api_version (legacy codec): version not in codec list, skipping",
				"group", gv.Group, "version", gv.Version)
			continue
		}
		firstIdx := slices.IndexFunc(out, func(v schema.GroupVersion) bool {
			return v.Group == gv.Group
		})
		if firstIdx != prefIdx {
			out[prefIdx], out[firstIdx] = out[firstIdx], out[prefIdx]
		}
	}
	return out, nil
}
