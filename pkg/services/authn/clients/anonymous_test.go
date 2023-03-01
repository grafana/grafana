package clients

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/anonymous/anontest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestAnonymous_Authenticate(t *testing.T) {
	type TestCase struct {
		desc string
		org  *org.Org
		cfg  *setting.Cfg
		err  error
	}

	tests := []TestCase{
		{
			desc: "should success with valid org configured",
			org:  &org.Org{ID: 1, Name: "some org"},
			cfg: &setting.Cfg{
				AnonymousOrgName: "some org",
				AnonymousOrgRole: "Viewer",
			},
		},
		{
			desc: "should return error if any error occurs during org lookup",
			err:  fmt.Errorf("some error"),
			cfg: &setting.Cfg{
				AnonymousOrgName: "some org",
				AnonymousOrgRole: "Viewer",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := Anonymous{
				cfg:                tt.cfg,
				log:                log.NewNopLogger(),
				orgService:         &orgtest.FakeOrgService{ExpectedOrg: tt.org, ExpectedError: tt.err},
				anonSessionService: &anontest.FakeAnonymousSessionService{},
			}

			identity, err := c.Authenticate(context.Background(), &authn.Request{})
			if err != nil {
				require.Error(t, err)
				require.Nil(t, identity)
			} else {
				require.Nil(t, err)

				assert.Equal(t, true, identity.ID == "")
				assert.Equal(t, tt.org.ID, identity.OrgID)
				assert.Equal(t, tt.org.Name, identity.OrgName)
				assert.Equal(t, tt.cfg.AnonymousOrgRole, string(identity.Role()))
			}
		})
	}
}
