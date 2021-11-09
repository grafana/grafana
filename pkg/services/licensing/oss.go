package licensing

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	openSource = "Open Source"
)

type OSSLicensingService struct {
	Cfg          *setting.Cfg
	HooksService *hooks.HooksService
}

func (*OSSLicensingService) HasLicense() bool {
	return false
}

func (*OSSLicensingService) Expiry() int64 {
	return 0
}

func (*OSSLicensingService) Edition() string {
	return openSource
}

func (*OSSLicensingService) StateInfo() string {
	return ""
}

func (*OSSLicensingService) ContentDeliveryPrefix() string {
	return "grafana-oss"
}

func (l *OSSLicensingService) LicenseURL(showAdminLicensingPage bool) string {
	if showAdminLicensingPage {
		return l.Cfg.AppSubURL + "/admin/upgrading"
	}

	return "https://grafana.com/oss/grafana?utm_source=grafana_footer"
}

func (*OSSLicensingService) HasValidLicense() bool {
	return false
}

func (*OSSLicensingService) EnabledFeatures() map[string]bool {
	return map[string]bool{}
}

func (*OSSLicensingService) FeatureEnabled(feature string) bool {
	return false
}

func ProvideService(cfg *setting.Cfg, hooksService *hooks.HooksService) *OSSLicensingService {
	l := &OSSLicensingService{
		Cfg:          cfg,
		HooksService: hooksService,
	}
	l.HooksService.AddIndexDataHook(func(indexData *dtos.IndexViewData, req *models.ReqContext) {
		for _, node := range indexData.NavTree {
			if node.Id == "admin" {
				node.Children = append(node.Children, &dtos.NavLink{
					Text: "Stats and license",
					Id:   "upgrading",
					Url:  l.LicenseURL(req.IsGrafanaAdmin),
					Icon: "unlock",
				})
			}
		}
	})
	return l
}
