package apiserver

import (
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/apiserver/versionpolicy"
	"github.com/grafana/grafana/pkg/setting"
)

// naturalOrderSnapshot captures each group's natural version priority (highest first) before
// applyPreferredAPIVersions reorders the scheme, so the cap ranks against natural order.
func naturalOrderSnapshot(scheme *runtime.Scheme, groupVersions []schema.GroupVersion) map[string][]string {
	order := make(map[string][]string, len(groupVersions))
	for _, gv := range groupVersions {
		if _, ok := order[gv.Group]; ok {
			continue
		}
		pvs := scheme.PrioritizedVersionsForGroup(gv.Group)
		versions := make([]string, 0, len(pvs))
		for _, v := range pvs {
			versions = append(versions, v.Version)
		}
		order[gv.Group] = versions
	}
	return order
}

// buildVersionPolicyIniLayer parses preferred_api_version and max_allowed_api_version into the resolver's ini layer.
func buildVersionPolicyIniLayer(cfg *setting.Cfg) (map[string]versionpolicy.VersionPolicy, error) {
	layer := map[string]versionpolicy.VersionPolicy{}
	section := cfg.SectionWithEnvOverrides("grafana-apiserver")

	if err := mergeGroupVersionListSetting(section.Key("preferred_api_version").String(), layer,
		func(p *versionpolicy.VersionPolicy, version string) { p.PreferredVersion = version }); err != nil {
		return nil, err
	}
	if err := mergeGroupVersionListSetting(section.Key("max_allowed_api_version").String(), layer,
		func(p *versionpolicy.VersionPolicy, version string) { p.MaxAllowedVersion = version }); err != nil {
		return nil, err
	}
	return layer, nil
}

// mergeGroupVersionListSetting parses a comma-separated group/version list and folds each entry into
// layer, using setVersion to write the parsed version onto that group's policy.
func mergeGroupVersionListSetting(csvSetting string, layer map[string]versionpolicy.VersionPolicy, setVersion func(policy *versionpolicy.VersionPolicy, version string)) error {
	csvSetting = strings.TrimSpace(csvSetting)
	if csvSetting == "" {
		return nil
	}
	for _, part := range strings.Split(csvSetting, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		gv, err := ParseGroupVersionSetting(part)
		if err != nil {
			return err
		}
		policy := layer[gv.Group]
		setVersion(&policy, gv.Version)
		layer[gv.Group] = policy
	}
	return nil
}
