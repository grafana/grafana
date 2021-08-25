package authinfoservice

import (
	"github.com/grafana/grafana/pkg/models"
)

type OSSUserProtectionImpl struct {
}

func ProvideOSSUserProtectionService() *OSSUserProtectionImpl {
	return &OSSUserProtectionImpl{}
}

func (*OSSUserProtectionImpl) AllowUserMapping(_ *models.User, _ string) error {
	return nil
}
