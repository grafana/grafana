package builder

import (
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/util/version"
	apimachineryversion "k8s.io/apimachinery/pkg/version"
	utilcompatibility "k8s.io/apiserver/pkg/util/compatibility"
	"k8s.io/component-base/compatibility"
)

// wrapper that will include grafana version in the /version response
type grafanaVersion struct {
	info *apimachineryversion.Info
	wrap compatibility.EffectiveVersion
}

func getEffectiveVersion(
	buildTimestamp int64,
	buildVersion string,
	buildCommit string,
	buildBranch string,
) compatibility.EffectiveVersion {
	v := utilcompatibility.DefaultBuildEffectiveVersion()
	patchver := 0 // required for semver

	info := v.Info()
	info.BuildDate = time.Unix(buildTimestamp, 0).UTC().Format(time.RFC3339)
	info.GitVersion = fmt.Sprintf("%s.%s.%d+grafana-v%s", info.Major, info.Minor, patchver, buildVersion)
	info.GitCommit = fmt.Sprintf("%s@%s", buildBranch, buildCommit)
	info.GitTreeState = fmt.Sprintf("grafana v%s", buildVersion)

	info2 := v.EmulationVersion().Info()
	info2.BuildDate = info.BuildDate
	info2.GitVersion = fmt.Sprintf("%s.%s.%d+grafana-v%s", info2.Major, info2.Minor, patchver, buildVersion)
	info2.GitCommit = info.GitCommit
	info2.GitTreeState = info.GitTreeState

	return &grafanaVersion{
		wrap: v,
		info: info,
	}
}

// Info implements compatibility.EffectiveVersion.
// This returns the grafana info along with the standard k8s info
func (g *grafanaVersion) Info() *apimachineryversion.Info {
	return g.info // otherwise the info gets replaced :(
}

// AllowedEmulationVersionRange implements compatibility.EffectiveVersion.
func (g *grafanaVersion) AllowedEmulationVersionRange() string {
	return g.wrap.AllowedEmulationVersionRange()
}

// AllowedMinCompatibilityVersionRange implements compatibility.EffectiveVersion.
func (g *grafanaVersion) AllowedMinCompatibilityVersionRange() string {
	return g.wrap.AllowedMinCompatibilityVersionRange()
}

// BinaryVersion implements compatibility.EffectiveVersion.
func (g *grafanaVersion) BinaryVersion() *version.Version {
	return g.wrap.BinaryVersion()
}

// EmulationVersion implements compatibility.EffectiveVersion.
func (g *grafanaVersion) EmulationVersion() *version.Version {
	return g.wrap.EmulationVersion()
}

// EqualTo implements compatibility.EffectiveVersion.
func (g *grafanaVersion) EqualTo(other compatibility.EffectiveVersion) bool {
	return g.wrap.EqualTo(other)
}

// MinCompatibilityVersion implements compatibility.EffectiveVersion.
func (g *grafanaVersion) MinCompatibilityVersion() *version.Version {
	return g.wrap.MinCompatibilityVersion()
}

// String implements compatibility.EffectiveVersion.
func (g *grafanaVersion) String() string {
	return g.wrap.String()
}

// Validate implements compatibility.EffectiveVersion.
func (g *grafanaVersion) Validate() []error {
	return g.wrap.Validate()
}
