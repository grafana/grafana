package service

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/stretchr/testify/assert"
)

func TestBuildGrafanaExternalID(t *testing.T) {
	id := buildGrafanaExternalID("stack123", "P7DC3E4760")
	assert.Equal(t, "stack123-P7DC3E4760", id)
	assert.True(t, isValidGrafanaExternalID(id, "stack123", "P7DC3E4760"))
	assert.False(t, isValidGrafanaExternalID(id, "otherstack", "P7DC3E4760"))
	assert.False(t, isValidGrafanaExternalID(id, "stack123", "OTHERUID"))
}

func TestEnsureGrafanaExternalID(t *testing.T) {
	t.Run("generates stack-uid for grafana_assume_role", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		ensureGrafanaExternalID("dsUid1", "stackABC", jd)
		assert.Equal(t, "stackABC-dsUid1", jd.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("keeps valid client-supplied ID for pre-save UX", func(t *testing.T) {
		clientID := "stackABC-dsUid1"
		jd := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: clientID,
		})
		ensureGrafanaExternalID("dsUid1", "stackABC", jd)
		assert.Equal(t, clientID, jd.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("replaces ID that belongs to another datasource", func(t *testing.T) {
		stolen := "stackABC-otherUid"
		jd := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: stolen,
		})
		ensureGrafanaExternalID("dsUid1", "stackABC", jd)
		assert.Equal(t, "stackABC-dsUid1", jd.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("no-op for keys auth", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{"authType": "keys", "externalId": "cross-account"})
		ensureGrafanaExternalID("dsUid1", "stackABC", jd)
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
		assert.Equal(t, "cross-account", jd.Get("externalId").MustString())
	})

	t.Run("no-op when stack external ID missing", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		ensureGrafanaExternalID("dsUid1", "", jd)
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
	})
}

func TestPreserveGrafanaExternalID(t *testing.T) {
	t.Run("preserves existing ID on update", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: "stackABC-dsUid1",
		})
		updated := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: "stackABC-stolen",
		})
		preserveGrafanaExternalID("dsUid1", "stackABC", existing, updated)
		assert.Equal(t, "stackABC-dsUid1", updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("generates when switching to grafana_assume_role without touching externalId", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			"authType":   "keys",
			"externalId": "cross-account-id",
		})
		updated := simplejson.NewFromAny(map[string]any{
			"authType":   grafanaAssumeRoleAuthType,
			"externalId": "cross-account-id",
		})
		preserveGrafanaExternalID("dsUid1", "stackABC", existing, updated)
		assert.Equal(t, "stackABC-dsUid1", updated.Get(grafanaExternalIDJSONKey).MustString())
		assert.Equal(t, "cross-account-id", updated.Get("externalId").MustString())
	})

	t.Run("leaves field when switching away from grafana_assume_role", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: "stackABC-dsUid1",
		})
		updated := simplejson.NewFromAny(map[string]any{
			"authType": "keys",
		})
		preserveGrafanaExternalID("dsUid1", "stackABC", existing, updated)
		assert.Equal(t, "stackABC-dsUid1", updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("does not auto-migrate legacy grafana_assume_role on update", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		updated := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType, "assumeRoleArn": "arn:aws:iam::123:role/x"})
		preserveGrafanaExternalID("dsUid1", "stackABC", existing, updated)
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})
}
