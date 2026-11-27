package user

import (
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/setting"
)

// setAvatarURLs fills AvatarUrl (left nil for users without an email) the same way the legacy /api/org/users/search handler does.
func setAvatarURLs(cfg *setting.Cfg, hits []iamv0.GetSearchUsersUserHit) {
	if cfg == nil {
		cfg = &setting.Cfg{}
	}
	for i := range hits {
		if url := dtos.GetGravatarUrl(cfg, hits[i].Email); url != "" {
			hits[i].AvatarUrl = &url
		}
	}
}
