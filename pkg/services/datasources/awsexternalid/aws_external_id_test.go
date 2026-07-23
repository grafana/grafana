package awsexternalid

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
	const uid, stack = "dsUid1", "stackABC"
	wantID := stack + "-" + uid

	t.Run("mints for new GAR datasources and sets mode true", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		ensureGrafanaExternalID(uid, stack, jd, true)
		assert.Equal(t, wantID, jd.Get(grafanaExternalIDJSONKey).MustString())
		assert.True(t, jd.Get(usePerDatasourceExternalIDJSONKey).MustBool())
	})

	t.Run("stack mode does not mint but keeps a valid dormant ID", func(t *testing.T) {
		empty := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: false,
		})
		ensureGrafanaExternalID(uid, stack, empty, true)
		assert.Empty(t, empty.Get(grafanaExternalIDJSONKey).MustString())

		dormant := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: false,
			grafanaExternalIDJSONKey:          wantID,
		})
		ensureGrafanaExternalID(uid, stack, dormant, true)
		assert.Equal(t, wantID, dormant.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("keeps a valid client-supplied ID", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: true,
			grafanaExternalIDJSONKey:          wantID,
		})
		ensureGrafanaExternalID(uid, stack, jd, true)
		assert.Equal(t, wantID, jd.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("scrubs stolen IDs even when FT is off or auth is not GAR", func(t *testing.T) {
		stolen := stack + "-otherUid"

		ftOff := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: stolen,
		})
		ensureGrafanaExternalID(uid, stack, ftOff, false)
		assert.Empty(t, ftOff.Get(grafanaExternalIDJSONKey).MustString())

		keys := simplejson.NewFromAny(map[string]any{
			"authType":               "keys",
			"externalId":             "cross-account",
			grafanaExternalIDJSONKey: stolen,
		})
		ensureGrafanaExternalID(uid, stack, keys, true)
		assert.Empty(t, keys.Get(grafanaExternalIDJSONKey).MustString())
		assert.Equal(t, "cross-account", keys.Get("externalId").MustString())
	})

	t.Run("does not mint when FT is off", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		ensureGrafanaExternalID(uid, stack, jd, false)
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("does not scrub when stack ID is empty", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: wantID,
		})
		ensureGrafanaExternalID(uid, "", jd, true)
		assert.Equal(t, wantID, jd.Get(grafanaExternalIDJSONKey).MustString())
		assert.Empty(t, jd.Get(usePerDatasourceExternalIDJSONKey).Interface())
	})
}

func TestPreserveGrafanaExternalID(t *testing.T) {
	const uid, stack = "dsUid1", "stackABC"
	wantID := stack + "-" + uid
	stolen := stack + "-otherUid"

	garExisting := func(id string) *simplejson.Json {
		m := map[string]any{"authType": grafanaAssumeRoleAuthType}
		if id != "" {
			m[grafanaExternalIDJSONKey] = id
		}
		return simplejson.NewFromAny(m)
	}

	t.Run("preserves a valid stored ID on stack toggle and Terraform omit", func(t *testing.T) {
		for _, tc := range []struct {
			name        string
			updated     map[string]any
			wantModeSet bool
			wantModeOn  bool
		}{
			{
				name: "stack mode",
				updated: map[string]any{
					"authType":                        grafanaAssumeRoleAuthType,
					usePerDatasourceExternalIDJSONKey: false,
					grafanaExternalIDJSONKey:          "",
				},
				wantModeSet: true,
				wantModeOn:  false,
			},
			{
				name:        "omit bool and ID",
				updated:     map[string]any{"authType": grafanaAssumeRoleAuthType},
				wantModeSet: true,
				wantModeOn:  true,
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				existing := simplejson.NewFromAny(map[string]any{
					"authType":                        grafanaAssumeRoleAuthType,
					usePerDatasourceExternalIDJSONKey: true,
					grafanaExternalIDJSONKey:          wantID,
				})
				updated := simplejson.NewFromAny(tc.updated)
				preserveGrafanaExternalID(uid, stack, existing, updated, true)
				assert.Equal(t, wantID, updated.Get(grafanaExternalIDJSONKey).MustString())
				modeSet, modeOn := usePerDatasourceExternalID(updated)
				assert.Equal(t, tc.wantModeSet, modeSet)
				assert.Equal(t, tc.wantModeOn, modeOn)
			})
		}
	})

	t.Run("keeps stored ID when stack ID is empty", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: true,
			grafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		preserveGrafanaExternalID(uid, "", existing, updated, true)
		assert.Equal(t, wantID, updated.Get(grafanaExternalIDJSONKey).MustString())
		assert.True(t, updated.Get(usePerDatasourceExternalIDJSONKey).MustBool())
	})

	t.Run("restores existing after scrubbing a stolen update payload", func(t *testing.T) {
		existing := garExisting(wantID)
		updated := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: stolen,
		})
		preserveGrafanaExternalID(uid, stack, existing, updated, true)
		assert.Equal(t, wantID, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("does not re-apply an invalid stored ID or auto-migrate legacy GAR", func(t *testing.T) {
		badStored := garExisting(stolen)
		updatedOmit := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		preserveGrafanaExternalID(uid, stack, badStored, updatedOmit, true)
		assert.Empty(t, updatedOmit.Get(grafanaExternalIDJSONKey).MustString())

		legacy := garExisting("")
		ordinary := simplejson.NewFromAny(map[string]any{
			"authType":      grafanaAssumeRoleAuthType,
			"assumeRoleArn": "arn:aws:iam::123:role/x",
		})
		preserveGrafanaExternalID(uid, stack, legacy, ordinary, true)
		assert.Empty(t, ordinary.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("keeps a valid client correction when stored ID is invalid", func(t *testing.T) {
		existing := garExisting(stolen)
		updated := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: wantID,
		})
		preserveGrafanaExternalID(uid, stack, existing, updated, true)
		assert.Equal(t, wantID, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("mints when legacy GAR opts in", func(t *testing.T) {
		existing := garExisting("")
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: true,
		})
		preserveGrafanaExternalID(uid, stack, existing, updated, true)
		assert.Equal(t, wantID, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("auth switch into GAR mints unless stack mode is requested", func(t *testing.T) {
		keys := simplejson.NewFromAny(map[string]any{
			"authType":   "keys",
			"externalId": "cross-account-id",
		})

		mint := simplejson.NewFromAny(map[string]any{
			"authType":   grafanaAssumeRoleAuthType,
			"externalId": "cross-account-id",
		})
		preserveGrafanaExternalID(uid, stack, keys, mint, true)
		assert.Equal(t, wantID, mint.Get(grafanaExternalIDJSONKey).MustString())
		assert.Equal(t, "cross-account-id", mint.Get("externalId").MustString())

		stackMode := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: false,
			"externalId":                      "cross-account-id",
		})
		preserveGrafanaExternalID(uid, stack, keys, stackMode, true)
		assert.Empty(t, stackMode.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("leaving GAR clears ID only when FT on", func(t *testing.T) {
		existing := garExisting(wantID)

		ftOn := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		preserveGrafanaExternalID(uid, stack, existing, ftOn, true)
		assert.Empty(t, ftOn.Get(grafanaExternalIDJSONKey).MustString())

		ftOff := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		preserveGrafanaExternalID(uid, stack, existing, ftOff, false)
		assert.Equal(t, wantID, ftOff.Get(grafanaExternalIDJSONKey).MustString())
	})
}
