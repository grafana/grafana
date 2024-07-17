package anonimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
				cfg:               tt.cfg,
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

				assert.Equal(t, identity.AnonymousTypedID, user.ID)
				assert.Equal(t, tt.org.ID, user.OrgID)
				assert.Equal(t, tt.org.Name, user.OrgName)
				assert.Equal(t, tt.cfg.AnonymousOrgRole, string(user.GetOrgRole()))
			}
		})
	}
}

func TestAnonymous_ResolveIdentity(t *testing.T) {
	type TestCase struct {
		desc        string
		cfg         *setting.Cfg
		orgID       int64
		namespaceID identity.TypedID
		org         *org.Org
		orgErr      error
		expectedErr error
	}

	tests := []TestCase{
		{
			desc: "should return error when org id is not the configured one",
			org:  &org.Org{ID: 2, Name: "some org"},
			cfg: &setting.Cfg{
				AnonymousOrgName: "some org",
			},
			orgID:       1,
			namespaceID: identity.AnonymousTypedID,
			expectedErr: errInvalidOrg,
		},
		{
			desc: "should return error when namespace id does not match anonymous namespace id",
			org:  &org.Org{ID: 1, Name: "some org"},
			cfg: &setting.Cfg{
				AnonymousOrgName: "some org",
			},
			orgID:       1,
			namespaceID: identity.MustParseTypedID("anonymous:1"),
			expectedErr: errInvalidID,
		},
		{
			desc: "should resolve identity",
			org:  &org.Org{ID: 1, Name: "some org"},
			cfg: &setting.Cfg{
				AnonymousOrgName: "some org",
			},
			orgID:       1,
			namespaceID: identity.AnonymousTypedID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := Anonymous{
				cfg:               tt.cfg,
				log:               log.NewNopLogger(),
				orgService:        &orgtest.FakeOrgService{ExpectedOrg: tt.org, ExpectedError: tt.orgErr},
				anonDeviceService: anontest.NewFakeService(),
			}

			identity, err := c.ResolveIdentity(context.Background(), tt.orgID, tt.namespaceID)
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
