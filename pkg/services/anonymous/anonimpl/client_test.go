package anonimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
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
				Anonymous: setting.AnonymousSettings{
					OrgRole: "Viewer",
					OrgName: "some org",
				},
			},
		},
		{
			desc: "should return error if any error occurs during org lookup",
			err:  fmt.Errorf("some error"),
			cfg: &setting.Cfg{
				Anonymous: setting.AnonymousSettings{
					OrgRole: "Viewer",
					OrgName: "some org",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := Anonymous{
				settingsProvider:  setting.ProvideService(tt.cfg),
				log:               log.NewNopLogger(),
				orgService:        &orgtest.FakeOrgService{ExpectedOrg: tt.org, ExpectedError: tt.err},
				anonDeviceService: anontest.NewFakeService(),
			}

			user, err := c.Authenticate(context.Background(), &authn.Request{})
			if err != nil {
				require.Error(t, err)
				require.Nil(t, user)
			} else {
				require.Nil(t, err)

				assert.Equal(t, "anonymous:0", user.GetID())
				assert.Equal(t, tt.org.ID, user.OrgID)
				assert.Equal(t, tt.org.Name, user.OrgName)
				assert.Equal(t, tt.cfg.Anonymous.OrgRole, string(user.GetOrgRole()))
			}
		})
	}
}

func TestAnonymous_ResolveIdentity(t *testing.T) {
	type TestCase struct {
		desc        string
		cfg         *setting.Cfg
		orgID       int64
		typ         claims.IdentityType
		id          string
		org         *org.Org
		orgErr      error
		expectedErr error
	}

	tests := []TestCase{
		{
			desc: "should return error when org id is not the configured one",
			org:  &org.Org{ID: 2, Name: "some org"},
			cfg: &setting.Cfg{
				Anonymous: setting.AnonymousSettings{
					OrgName: "some org",
				},
			},
			orgID:       1,
			typ:         claims.TypeAnonymous,
			id:          "0",
			expectedErr: errInvalidOrg,
		},
		{
			desc: "should return error when namespace id does not match anonymous namespace id",
			org:  &org.Org{ID: 1, Name: "some org"},
			cfg: &setting.Cfg{
				Anonymous: setting.AnonymousSettings{
					OrgName: "some org",
				},
			},
			orgID:       1,
			typ:         claims.TypeAnonymous,
			id:          "1",
			expectedErr: errInvalidID,
		},
		{
			desc: "should resolve identity",
			org:  &org.Org{ID: 1, Name: "some org"},
			cfg: &setting.Cfg{
				Anonymous: setting.AnonymousSettings{
					OrgName: "some org",
				},
			},
			orgID: 1,
			typ:   claims.TypeAnonymous,
			id:    "0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := Anonymous{
				settingsProvider:  setting.ProvideService(tt.cfg),
				log:               log.NewNopLogger(),
				orgService:        &orgtest.FakeOrgService{ExpectedOrg: tt.org, ExpectedError: tt.orgErr},
				anonDeviceService: anontest.NewFakeService(),
			}

			identity, err := c.ResolveIdentity(context.Background(), tt.orgID, tt.typ, tt.id)
			if tt.expectedErr != nil {
				assert.ErrorIs(t, err, tt.expectedErr)
				assert.Nil(t, identity)
			} else {
				assert.NoError(t, err)
				assert.EqualValues(t, c.newAnonymousIdentity(tt.org), identity)
			}
		})
	}
}
