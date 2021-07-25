package authinfoservice

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
)

func init() {
	registry.RegisterService(&OSSUserProtectionImpl{})
}

type OSSUserProtectionImpl struct {
}

func (OSSUserProtectionImpl) Init() error {
	return nil
}

func (OSSUserProtectionImpl) AllowUserMapping(_ *models.User, _ string) (bool, error) {
	return true, nil
}
