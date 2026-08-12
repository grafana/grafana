package appinstaller

import (
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"k8s.io/apimachinery/pkg/runtime/schema"
	serverstorage "k8s.io/apiserver/pkg/server/storage"
)

func NewAPIResourceConfig(installers []appsdkapiserver.AppInstaller) *serverstorage.ResourceConfig {
	ret := serverstorage.NewResourceConfig()
	enable := []schema.GroupVersion{}
	disable := []schema.GroupVersion{}

	for _, installer := range installers {
		for _, version := range installer.ManifestData().Versions {
			gv := schema.GroupVersion{
				Group:   installer.ManifestData().Group,
				Version: version.Name,
			}
			if version.Served {
				enable = append(enable, gv)
			} else {
				disable = append(disable, gv)
			}
		}
	}

	ret.EnableVersions(enable...)
	ret.DisableVersions(disable...)

	return ret
}
