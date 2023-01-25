package licensing

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	openSource = "Open Source"
)

type OSSLicensingService struct {
	Cfg          *setting.Cfg
	HooksService *hooks.HooksService
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
	l.HooksService.AddIndexDataHook(func(indexData *dtos.IndexViewData, req *contextmodel.ReqContext) {
		if !req.IsGrafanaAdmin {
			return
		}

		var adminNodeID string

		if cfg.IsFeatureToggleEnabled("topnav") {
			adminNodeID = navtree.NavIDCfg
		} else {
			adminNodeID = navtree.NavIDAdmin
		}

		if adminNode := indexData.NavTree.FindById(adminNodeID); adminNode != nil {
			adminNode.Children = append(adminNode.Children, &navtree.NavLink{
				Text: "Stats and license",
				Id:   "upgrading",
				Url:  l.LicenseURL(req.IsGrafanaAdmin),
				Icon: "unlock",
			})
		}
	})

	return l
}
