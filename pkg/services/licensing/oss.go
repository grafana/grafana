package licensing

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/setting"
)

type OSSLicensingService struct {
	Cfg          *setting.Cfg        `inject:""`
	HooksService *hooks.HooksService `inject:""`
}

func (*OSSLicensingService) HasLicense() bool {
	return false
}

func (*OSSLicensingService) Expiry() int64 {
	return 0
}

func (l *OSSLicensingService) Init() error {
	l.HooksService.AddIndexDataHook(func(indexData *dtos.IndexViewData) {
		for _, node := range indexData.NavTree {
			if node.Id == "admin" {
				node.Children = append(node.Children, &dtos.NavLink{
					Text: "Upgrade",
					Id:   "upgrading",
					Url:  l.Cfg.AppSubUrl + "/admin/upgrading",
					Icon: "fa fa-fw fa-unlock-alt",
				})
			}
		}
	})

	return nil
}

func (*OSSLicensingService) HasValidLicense() bool {
	return false
}
