package orgcalculator

import "github.com/grafana/grafana/pkg/services/user"

type OrgCalculator interface {
	// GetOrgsToMigrate returns the orgs to migrate for a given user
	GetOrgsToMigrate(signedInUser *user.SignedInUser) []int64
}

// OssOrgCalculator is the oss implementation of OrgCalculator
type OssOrgCalculator struct{}

var _ OrgCalculator = (*OssOrgCalculator)(nil)

func (c OssOrgCalculator) GetOrgsToMigrate(signedInUser *user.SignedInUser) []int64 {
	return []int64{signedInUser.GetOrgID()}
}

func ProvideOssService() *OssOrgCalculator {
	return &OssOrgCalculator{}
}
