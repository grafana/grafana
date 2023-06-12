package authinfoservice

import "github.com/grafana/grafana/pkg/services/user"

type OSSUserProtectionImpl struct {
}

func ProvideOSSUserProtectionService() *OSSUserProtectionImpl {
	return &OSSUserProtectionImpl{}
}

func (*OSSUserProtectionImpl) AllowUserMapping(_ *user.User, _ string) error {
	return nil
}
