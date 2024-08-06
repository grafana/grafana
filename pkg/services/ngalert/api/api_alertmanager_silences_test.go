package api

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/go-openapi/strfmt"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestSilenceCreate(t *testing.T) {
	makeSilence := func(comment string, createdBy string,
		startsAt, endsAt strfmt.DateTime, matchers amv2.Matchers) amv2.Silence {
		return amv2.Silence{
			Comment:   &comment,
			CreatedBy: &createdBy,
			StartsAt:  &startsAt,
			EndsAt:    &endsAt,
			Matchers:  matchers,
		}
	}

	now := time.Now()
	dt := func(t time.Time) strfmt.DateTime { return strfmt.DateTime(t) }
	tru := true
	testString := "testName"
	matchers := amv2.Matchers{&amv2.Matcher{Name: &testString, IsEqual: &tru, IsRegex: &tru, Value: &testString}}

	cases := []struct {
		name    string
		silence amv2.Silence
		status  int
	}{
		{"Valid Silence",
			makeSilence("", "tests", dt(now), dt(now.Add(1*time.Second)), matchers),
			http.StatusAccepted,
		},
		{"No Comment Silence",
			func() amv2.Silence {
				s := makeSilence("", "tests", dt(now), dt(now.Add(1*time.Second)), matchers)
				s.Comment = nil
				return s
			}(),
			http.StatusBadRequest,
		},
	}

	for _, cas := range cases {
		t.Run(cas.name, func(t *testing.T) {
			rc := contextmodel.ReqContext{
				Context: &web.Context{
					Req: &http.Request{},
				},
				SignedInUser: &user.SignedInUser{
					OrgRole: org.RoleEditor,
					OrgID:   1,
					Permissions: map[int64]map[string][]string{
						1: {
							accesscontrol.ActionAlertingInstanceRead:   {},
							accesscontrol.ActionAlertingInstanceCreate: {},
						},
					},
				},
			}

			srv := createSut(t)

			resp := srv.RouteCreateSilence(&rc, amv2.PostableSilence{
				ID:      "",
				Silence: cas.silence,
			})
			require.Equal(t, cas.status, resp.Status())
		})
	}
}

func TestRouteCreateSilence(t *testing.T) {
	tesCases := []struct {
		name           string
		silence        func() ngmodels.Silence
		permissions    map[int64]map[string][]string
		expectedStatus int
	}{
		{
			name:    "new silence, role-based access control is enabled, not authorized",
			silence: ngmodels.SilenceGen(ngmodels.SilenceMuts.WithEmptyId()),
			permissions: map[int64]map[string][]string{
				1: {},
			},
			expectedStatus: http.StatusForbidden,
		},
		{
			name:    "new silence, role-based access control is enabled, authorized",
			silence: ngmodels.SilenceGen(ngmodels.SilenceMuts.WithEmptyId()),
			permissions: map[int64]map[string][]string{
				1: {
					accesscontrol.ActionAlertingInstanceRead:   {},
					accesscontrol.ActionAlertingInstanceCreate: {},
				},
			},
			expectedStatus: http.StatusAccepted,
		},
		{
			name:    "update silence, role-based access control is enabled, not authorized",
			silence: ngmodels.SilenceGen(),
			permissions: map[int64]map[string][]string{
				1: {accesscontrol.ActionAlertingInstanceCreate: {}},
			},
			expectedStatus: http.StatusForbidden,
		},
		{
			name:    "update silence, role-based access control is enabled, authorized",
			silence: ngmodels.SilenceGen(),
			permissions: map[int64]map[string][]string{
				1: {
					accesscontrol.ActionAlertingInstanceRead:   {},
					accesscontrol.ActionAlertingInstanceUpdate: {},
				},
			},
			expectedStatus: http.StatusAccepted,
		},
	}

	for _, tesCase := range tesCases {
		t.Run(tesCase.name, func(t *testing.T) {
			sut := createSut(t)

			rc := contextmodel.ReqContext{
				Context: &web.Context{
					Req: &http.Request{},
				},
				SignedInUser: &user.SignedInUser{
					Permissions: tesCase.permissions,
					OrgID:       1,
				},
			}

			silence := notifier.SilenceToPostableSilence(tesCase.silence())

			if silence.ID != "" {
				alertmanagerFor, err := sut.mam.AlertmanagerFor(1)
				require.NoError(t, err)
				silence.ID = ""
				newID, err := alertmanagerFor.CreateSilence(context.Background(), silence)
				require.NoError(t, err)
				silence.ID = newID
			}

			response := sut.RouteCreateSilence(&rc, *silence)
			require.Equal(t, tesCase.expectedStatus, response.Status())
		})
	}
}
