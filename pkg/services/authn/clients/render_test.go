package clients

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/rendering"
)

func TestRender_Authenticate(t *testing.T) {
	type TestCase struct {
		desc              string
		renderKey         string
		req               *authn.Request
		expectedErr       error
		expectedIdentity  *authn.Identity
		expectedRenderUsr *rendering.RenderUser
	}

	tests := []TestCase{
		{
			desc:      "expect valid render key to return anonymous user identity for org role Viewer",
			renderKey: "123",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{"Cookie": {"renderKey=123"}},
				},
			},
			expectedIdentity: &authn.Identity{
				ID:              "0",
				UID:             "0",
				Type:            claims.TypeAnonymous,
				OrgID:           1,
				OrgRoles:        map[int64]org.RoleType{1: org.RoleViewer},
				AuthenticatedBy: login.RenderModule,
				ClientParams:    authn.ClientParams{SyncPermissions: true},
			},
			expectedRenderUsr: &rendering.RenderUser{
				OrgID:   1,
				UserID:  0,
				OrgRole: "Viewer",
			},
		},
		{
			desc:      "expect valid render key to return render user identity for org role Admin",
			renderKey: "123",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{"Cookie": {"renderKey=123"}},
				},
			},
			expectedIdentity: &authn.Identity{
				ID:              "0",
				UID:             "0",
				Type:            claims.TypeRenderService,
				OrgID:           1,
				OrgRoles:        map[int64]org.RoleType{1: org.RoleAdmin},
				AuthenticatedBy: login.RenderModule,
				ClientParams:    authn.ClientParams{SyncPermissions: true},
			},
			expectedRenderUsr: &rendering.RenderUser{
				OrgID:   1,
				UserID:  0,
				OrgRole: "Admin",
			},
		},
		{
			desc:      "expect valid render key connected to user to return identity",
			renderKey: "123",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{"Cookie": {"renderKey=123"}},
				},
			},
			expectedIdentity: &authn.Identity{
				ID:              "1",
				Type:            claims.TypeUser,
				AuthenticatedBy: login.RenderModule,
				ClientParams:    authn.ClientParams{FetchSyncedUser: true, SyncPermissions: true},
			},
			expectedRenderUsr: &rendering.RenderUser{
				OrgID:  1,
				UserID: 1,
			},
		},
		{
			desc:      "expect error when render key is invalid",
			renderKey: "123",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{"Cookie": {"renderKey=123"}},
				},
			},
			expectedErr: errInvalidRenderKey,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()
			renderService := rendering.NewMockService(ctrl)
			renderService.EXPECT().GetRenderUser(gomock.Any(), tt.renderKey).Return(tt.expectedRenderUsr, tt.expectedRenderUsr != nil)

			c := ProvideRender(renderService)
			identity, err := c.Authenticate(context.Background(), tt.req)
			if tt.expectedErr != nil {
				assert.ErrorIs(t, tt.expectedErr, err)
				assert.Nil(t, identity)
			} else {
				assert.NoError(t, err)
				// ignore LastSeenAt
				identity.LastSeenAt = time.Time{}
				assert.EqualValues(t, *tt.expectedIdentity, *identity)
			}
		})
	}
}

func TestRender_Test(t *testing.T) {
	type TestCase struct {
		desc     string
		req      *authn.Request
		expected bool
	}

	tests := []TestCase{
		{
			desc: "should success when request has render cookie available",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{"Cookie": {"renderKey=123"}},
			}},
			expected: true,
		},
		{
			desc: "should fail if no http request is passed",
			req:  &authn.Request{},
		},
		{
			desc: "should fail if no renderKey cookie is present in request",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{"Cookie": {"notRenderKey=123"}},
			}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := ProvideRender(&rendering.MockService{})
			assert.Equal(t, tt.expected, c.Test(context.Background(), tt.req))
		})
	}
}
