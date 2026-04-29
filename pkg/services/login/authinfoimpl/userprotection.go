package authinfoimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

type OSSUserProtectionImpl struct {
}

func ProvideOSSUserProtectionService() *OSSUserProtectionImpl {
	return &OSSUserProtectionImpl{}
}

func (*OSSUserProtectionImpl) AllowUserMapping(_ *user.User, _ string) error {
	return nil
}

func (*OSSUserProtectionImpl) ShouldProtect(_ context.Context, _ *user.User) (bool, error) {
	return false, nil
}
