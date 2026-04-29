package prefapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/utils/ptr"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	prefutils "github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func newReqContext(orgID int64, identifier string) *contextmodel.ReqContext {
	httpReq := httptest.NewRequest(http.MethodGet, "/", nil)
	return &contextmodel.ReqContext{
		Context:      &web.Context{Req: httpReq},
		SignedInUser: &user.SignedInUser{OrgID: orgID, UserUID: identifier},
	}
}

func TestK8sHandler_GetPreferences(t *testing.T) {
	t.Run("returns spec on success", func(t *testing.T) {
		client := NewMockK8sClient(t)
		spec := &preferences.PreferencesSpec{Theme: ptr.To("dark")}
		client.EXPECT().Get(mock.Anything, prefutils.OwnerReference{Owner: prefutils.UserResourceOwner, Identifier: "u1"}).Return(spec, nil)

		h := NewK8sHandler(client, dashboards.NewFakeDashboardService(t))
		resp := h.GetPreferences(newReqContext(1, "u1"), UserOwner(newReqContext(1, "u1")))

		require.Equal(t, http.StatusOK, resp.Status())
		var got preferences.PreferencesSpec
		require.NoError(t, json.Unmarshal(resp.Body(), &got))
		assert.Equal(t, "dark", *got.Theme)
	})

	t.Run("maps StatusError to its code", func(t *testing.T) {
		client := NewMockK8sClient(t)
		client.EXPECT().Get(mock.Anything, mock.Anything).Return(nil, apierrors.NewForbidden(schema.GroupResource{}, "x", errors.New("nope")))

		h := NewK8sHandler(client, dashboards.NewFakeDashboardService(t))
		resp := h.GetPreferences(newReqContext(1, "u1"), NamespaceOwner())

		assert.Equal(t, http.StatusForbidden, resp.Status())
	})

	t.Run("non-status error becomes 500", func(t *testing.T) {
		client := NewMockK8sClient(t)
		client.EXPECT().Get(mock.Anything, mock.Anything).Return(nil, errors.New("boom"))

		h := NewK8sHandler(client, dashboards.NewFakeDashboardService(t))
		resp := h.GetPreferences(newReqContext(1, "u1"), NamespaceOwner())

		assert.Equal(t, http.StatusInternalServerError, resp.Status())
	})
}

func TestK8sHandler_UpdatePreferences(t *testing.T) {
	t.Run("forwards full spec with empty-string scalars (PUT replace semantics)", func(t *testing.T) {
		client := NewMockK8sClient(t)
		var captured *preferences.PreferencesSpec
		client.EXPECT().Update(mock.Anything, mock.Anything, mock.Anything).
			Run(func(_ *contextmodel.ReqContext, _ prefutils.OwnerReference, spec *preferences.PreferencesSpec) {
				captured = spec
			}).Return(nil)

		h := NewK8sHandler(client, dashboards.NewFakeDashboardService(t))
		resp := h.UpdatePreferences(newReqContext(1, "u1"), UserOwner(newReqContext(1, "u1")), &dtos.UpdatePrefsCmd{
			Theme:    "dark",
			Timezone: "",
		})

		require.Equal(t, http.StatusOK, resp.Status())
		require.NotNil(t, captured)
		assert.Equal(t, "dark", *captured.Theme)
		require.NotNil(t, captured.Timezone)
		assert.Equal(t, "", *captured.Timezone, "PUT must send empty strings, not nil, so missing fields are cleared")
		require.NotNil(t, captured.WeekStart)
		assert.Equal(t, "", *captured.WeekStart)
	})

	t.Run("resolves home dashboard ID to UID via dashboards service", func(t *testing.T) {
		ds := dashboards.NewFakeDashboardService(t)
		ds.On("GetDashboard", mock.Anything, mock.MatchedBy(func(q *dashboards.GetDashboardQuery) bool {
			return q.ID == 42 && q.OrgID == 1
		})).Return(&dashboards.Dashboard{UID: "abc"}, nil)

		client := NewMockK8sClient(t)
		var captured *preferences.PreferencesSpec
		client.EXPECT().Update(mock.Anything, mock.Anything, mock.Anything).
			Run(func(_ *contextmodel.ReqContext, _ prefutils.OwnerReference, spec *preferences.PreferencesSpec) {
				captured = spec
			}).Return(nil)

		h := NewK8sHandler(client, ds)
		resp := h.UpdatePreferences(newReqContext(1, "u1"), UserOwner(newReqContext(1, "u1")), &dtos.UpdatePrefsCmd{
			HomeDashboardID: 42,
		})

		require.Equal(t, http.StatusOK, resp.Status())
		require.NotNil(t, captured.HomeDashboardUID)
		assert.Equal(t, "abc", *captured.HomeDashboardUID)
	})

	t.Run("explicit UID skips dashboards service lookup", func(t *testing.T) {
		client := NewMockK8sClient(t)
		client.EXPECT().Update(mock.Anything, mock.Anything, mock.Anything).Return(nil)

		ds := dashboards.NewFakeDashboardService(t) // no expectations — must not be called
		h := NewK8sHandler(client, ds)
		resp := h.UpdatePreferences(newReqContext(1, "u1"), UserOwner(newReqContext(1, "u1")), &dtos.UpdatePrefsCmd{
			HomeDashboardUID: ptr.To("supplied"),
			HomeDashboardID:  42,
		})

		require.Equal(t, http.StatusOK, resp.Status())
	})

	t.Run("dashboard not found returns 404", func(t *testing.T) {
		ds := dashboards.NewFakeDashboardService(t)
		ds.On("GetDashboard", mock.Anything, mock.Anything).Return(nil, dashboards.ErrDashboardNotFound)

		h := NewK8sHandler(NewMockK8sClient(t), ds)
		resp := h.UpdatePreferences(newReqContext(1, "u1"), UserOwner(newReqContext(1, "u1")), &dtos.UpdatePrefsCmd{
			HomeDashboardID: 42,
		})

		assert.Equal(t, http.StatusNotFound, resp.Status())
	})
}

func TestK8sHandler_PatchPreferences(t *testing.T) {
	t.Run("forwards only set fields (PATCH merge semantics)", func(t *testing.T) {
		client := NewMockK8sClient(t)
		var captured *preferences.PreferencesSpec
		client.EXPECT().Patch(mock.Anything, mock.Anything, mock.Anything).
			Run(func(_ *contextmodel.ReqContext, _ prefutils.OwnerReference, spec *preferences.PreferencesSpec) {
				captured = spec
			}).Return(nil)

		h := NewK8sHandler(client, dashboards.NewFakeDashboardService(t))
		resp := h.PatchPreferences(newReqContext(1, "u1"), UserOwner(newReqContext(1, "u1")), &dtos.PatchPrefsCmd{
			Theme: ptr.To("light"),
		})

		require.Equal(t, http.StatusOK, resp.Status())
		require.NotNil(t, captured)
		require.NotNil(t, captured.Theme)
		assert.Equal(t, "light", *captured.Theme)
		assert.Nil(t, captured.Timezone, "unset fields must stay nil so merge-patch leaves them untouched")
		assert.Nil(t, captured.WeekStart)
	})

	t.Run("nil HomeDashboardID does not panic", func(t *testing.T) {
		client := NewMockK8sClient(t)
		client.EXPECT().Patch(mock.Anything, mock.Anything, mock.Anything).Return(nil)

		h := NewK8sHandler(client, dashboards.NewFakeDashboardService(t))
		resp := h.PatchPreferences(newReqContext(1, "u1"), UserOwner(newReqContext(1, "u1")), &dtos.PatchPrefsCmd{
			Theme: ptr.To("light"),
		})

		assert.Equal(t, http.StatusOK, resp.Status())
	})

	t.Run("propagates k8s NotFound as 404", func(t *testing.T) {
		client := NewMockK8sClient(t)
		client.EXPECT().Patch(mock.Anything, mock.Anything, mock.Anything).
			Return(apierrors.NewNotFound(schema.GroupResource{Resource: "preferences"}, "user-u1"))

		h := NewK8sHandler(client, dashboards.NewFakeDashboardService(t))
		resp := h.PatchPreferences(newReqContext(1, "u1"), UserOwner(newReqContext(1, "u1")), &dtos.PatchPrefsCmd{})

		assert.Equal(t, http.StatusNotFound, resp.Status())
	})
}

func TestK8sHandler_OwnerHelpers(t *testing.T) {
	t.Run("UserOwner uses identifier from signed-in user", func(t *testing.T) {
		c := newReqContext(1, "user-uid")
		assert.Equal(t, prefutils.OwnerReference{Owner: prefutils.UserResourceOwner, Identifier: "user-uid"}, UserOwner(c))
	})
	t.Run("TeamOwner wraps the team UID", func(t *testing.T) {
		assert.Equal(t, prefutils.OwnerReference{Owner: prefutils.TeamResourceOwner, Identifier: "tuid"}, TeamOwner("tuid"))
	})
	t.Run("NamespaceOwner has no identifier", func(t *testing.T) {
		assert.Equal(t, prefutils.OwnerReference{Owner: prefutils.NamespaceResourceOwner}, NamespaceOwner())
	})
}
