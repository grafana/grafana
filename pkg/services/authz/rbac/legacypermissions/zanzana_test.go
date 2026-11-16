package legacypermissions

import (
	"context"
	"sort"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/client"
)

type fakeZanzanaClient struct {
	client.NoopClient
	listResp *authzv1.ListResponse
	listErr  error
}

func (f *fakeZanzanaClient) List(context.Context, *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	return f.listResp, f.listErr
}

func sortPermissions(perms []ac.Permission) {
	sort.Slice(perms, func(i, j int) bool {
		if perms[i].Action != perms[j].Action {
			return perms[i].Action < perms[j].Action
		}
		return perms[i].Scope < perms[j].Scope
	})
}
