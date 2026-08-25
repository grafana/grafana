package awsexternalid

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

// callBeforeSave runs the production entry point with FT and stack config wired for tests.
func callBeforeSave(t *testing.T, ftOn bool, uid, stack string, existing, jsonData *simplejson.Json) {
	t.Helper()
	if ftOn {
		featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAwsAssumeRolePerDatasourceExternalId)
	} else {
		featuremgmt.WithDisabledFlags(t, featuremgmt.FlagAwsAssumeRolePerDatasourceExternalId)
	}
	cfg := &setting.Cfg{AWSExternalId: stack}
	BeforeSave(t.Context(), uid, cfg, existing, jsonData)
}

func beforeEnsure(t *testing.T, uid, stack string, jsonData *simplejson.Json, allowGenerate bool) {
	callBeforeSave(t, allowGenerate, uid, stack, nil, jsonData)
}

func beforePreserve(t *testing.T, uid, stack string, existing, updated *simplejson.Json, allowGenerate bool) {
	callBeforeSave(t, allowGenerate, uid, stack, existing, updated)
}

func TestBeforeSave_clearsPayloadExternalIDs(t *testing.T) {
	const uid, stack = "dsUid1", "stackABC"
	stolen := stack + "-otherUid"

	t.Run("update with FT off and non-GAR leaves both ID keys empty", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                    "keys",
			grafanaExternalIDJSONKey:      stolen,
			sigV4GrafanaExternalIDJSONKey: stolen,
		})
		callBeforeSave(t, false, uid, stack, existing, updated)
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
	})

	t.Run("create with FT off clears client ID without minting", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: stolen,
		})
		callBeforeSave(t, false, uid, stack, nil, jd)
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
		assert.Empty(t, jd.Get(sigV4GrafanaExternalIDJSONKey).MustString())
	})
}

func TestBuildGrafanaExternalID(t *testing.T) {
	id := buildGrafanaExternalID("stack123", "P7DC3E4760")
	assert.True(t, isValidGrafanaExternalID(id, "stack123", "P7DC3E4760"))
	assert.False(t, isValidGrafanaExternalID(id, "otherstack", "P7DC3E4760"))
	assert.False(t, isValidGrafanaExternalID(id, "stack123", "OTHERUID"))
	assert.False(t, isValidGrafanaExternalID("stack123-P7DC3E4760", "stack123", "P7DC3E4760"))                  // no hex suffix
	assert.False(t, isValidGrafanaExternalID("stack123-P7DC3E4760-abcd", "stack123", "P7DC3E4760"))             // short
	assert.False(t, isValidGrafanaExternalID("stack123-P7DC3E4760-gggggggggggggggg", "stack123", "P7DC3E4760")) // non-hex

	id2 := buildGrafanaExternalID("stack123", "P7DC3E4760")
	assert.NotEqual(t, id, id2) // fresh hex suffix each mint
}

func TestIsValidGrafanaExternalID_dashesInStackAndUID(t *testing.T) {
	stack, uid := "stacks-abc-1", "my-ds-uid"
	id := buildGrafanaExternalID(stack, uid)
	assert.True(t, isValidGrafanaExternalID(id, stack, uid))
}

func TestIsValidGrafanaExternalID_regexMetacharacters(t *testing.T) {
	stack, uid := "stack.1+2", "ds(uid)"
	assert.True(t, isValidGrafanaExternalID(buildGrafanaExternalID(stack, uid), stack, uid))
	// The stack ID and UID are matched literally, so an ID that only matches when they are
	// read as a pattern is rejected.
	assert.False(t, isValidGrafanaExternalID("stackX12-dsuid-0123456789abcdef", stack, uid))
}

func TestEnsureGrafanaExternalID(t *testing.T) {
	const uid, stack = "dsUid1", "stackABC"

	t.Run("mints for new GAR datasources and sets mode true", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		beforeEnsure(t, uid, stack, jd, true)
		assert.True(t, isValidGrafanaExternalID(jd.Get(grafanaExternalIDJSONKey).MustString(), stack, uid))
		assert.True(t, jd.Get(usePerDatasourceExternalIDJSONKey).MustBool())
	})

	t.Run("stack mode does not mint and discards client ID on create", func(t *testing.T) {
		empty := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: false,
		})
		beforeEnsure(t, uid, stack, empty, true)
		assert.Empty(t, empty.Get(grafanaExternalIDJSONKey).MustString())

		dormant := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: false,
			grafanaExternalIDJSONKey:          buildGrafanaExternalID(stack, uid),
		})
		beforeEnsure(t, uid, stack, dormant, true)
		assert.Empty(t, dormant.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("discards client-supplied ID and mints a new one", func(t *testing.T) {
		pasted := buildGrafanaExternalID(stack, uid)
		jd := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: true,
			grafanaExternalIDJSONKey:          pasted,
		})
		beforeEnsure(t, uid, stack, jd, true)
		got := jd.Get(grafanaExternalIDJSONKey).MustString()
		assert.True(t, isValidGrafanaExternalID(got, stack, uid))
		assert.NotEqual(t, pasted, got)
	})

	t.Run("scrubs stolen IDs even when FT is off or auth is not GAR", func(t *testing.T) {
		stolen := stack + "-otherUid"

		ftOff := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: stolen,
		})
		beforeEnsure(t, uid, stack, ftOff, false)
		assert.Empty(t, ftOff.Get(grafanaExternalIDJSONKey).MustString())

		keys := simplejson.NewFromAny(map[string]any{
			"authType":               "keys",
			"externalId":             "cross-account",
			grafanaExternalIDJSONKey: stolen,
		})
		beforeEnsure(t, uid, stack, keys, true)
		assert.Empty(t, keys.Get(grafanaExternalIDJSONKey).MustString())
		assert.Equal(t, "cross-account", keys.Get("externalId").MustString())
	})

	t.Run("does not mint when FT is off", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		beforeEnsure(t, uid, stack, jd, false)
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("discards client ID on create even when stack ID is empty", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: buildGrafanaExternalID(stack, uid),
		})
		beforeEnsure(t, uid, "", jd, true)
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("two creates mint different hex suffixes for the same stack and uid", func(t *testing.T) {
		a := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		b := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		beforeEnsure(t, uid, stack, a, true)
		beforeEnsure(t, uid, stack, b, true)
		idA := a.Get(grafanaExternalIDJSONKey).MustString()
		idB := b.Get(grafanaExternalIDJSONKey).MustString()
		assert.True(t, isValidGrafanaExternalID(idA, stack, uid))
		assert.True(t, isValidGrafanaExternalID(idB, stack, uid))
		assert.NotEqual(t, idA, idB)
	})
}

func TestPreserveGrafanaExternalID(t *testing.T) {
	const uid, stack = "dsUid1", "stackABC"
	wantID := buildGrafanaExternalID(stack, uid)
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
				beforePreserve(t, uid, stack, existing, updated, true)
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
		beforePreserve(t, uid, "", existing, updated, true)
		assert.Equal(t, wantID, updated.Get(grafanaExternalIDJSONKey).MustString())
		assert.True(t, updated.Get(usePerDatasourceExternalIDJSONKey).MustBool())
	})

	t.Run("restores existing after scrubbing a stolen update payload", func(t *testing.T) {
		existing := garExisting(wantID)
		updated := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: stolen,
		})
		beforePreserve(t, uid, stack, existing, updated, true)
		assert.Equal(t, wantID, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("does not re-apply an invalid stored ID or auto-migrate legacy GAR", func(t *testing.T) {
		badStored := garExisting(stolen)
		updatedOmit := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		beforePreserve(t, uid, stack, badStored, updatedOmit, true)
		assert.Empty(t, updatedOmit.Get(grafanaExternalIDJSONKey).MustString())

		legacy := garExisting("")
		ordinary := simplejson.NewFromAny(map[string]any{
			"authType":      grafanaAssumeRoleAuthType,
			"assumeRoleArn": "arn:aws:iam::123:role/x",
		})
		beforePreserve(t, uid, stack, legacy, ordinary, true)
		assert.Empty(t, ordinary.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("mints instead of adopting client ID when stored ID is invalid", func(t *testing.T) {
		existing := garExisting("")
		clientPaste := buildGrafanaExternalID(stack, uid)
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: true,
			grafanaExternalIDJSONKey:          clientPaste,
		})
		beforePreserve(t, uid, stack, existing, updated, true)
		got := updated.Get(grafanaExternalIDJSONKey).MustString()
		assert.True(t, isValidGrafanaExternalID(got, stack, uid))
		assert.NotEqual(t, clientPaste, got)
	})

	t.Run("does not adopt a different valid client ID when stored ID exists", func(t *testing.T) {
		existing := garExisting(wantID)
		other := buildGrafanaExternalID(stack, uid)
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: true,
			grafanaExternalIDJSONKey:          other,
		})
		beforePreserve(t, uid, stack, existing, updated, true)
		assert.Equal(t, wantID, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("mints when legacy GAR opts in", func(t *testing.T) {
		existing := garExisting("")
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: true,
		})
		beforePreserve(t, uid, stack, existing, updated, true)
		assert.True(t, isValidGrafanaExternalID(updated.Get(grafanaExternalIDJSONKey).MustString(), stack, uid))
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
		beforePreserve(t, uid, stack, keys, mint, true)
		assert.True(t, isValidGrafanaExternalID(mint.Get(grafanaExternalIDJSONKey).MustString(), stack, uid))
		assert.Equal(t, "cross-account-id", mint.Get("externalId").MustString())

		stackMode := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: false,
			"externalId":                      "cross-account-id",
		})
		beforePreserve(t, uid, stack, keys, stackMode, true)
		assert.Empty(t, stackMode.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("leaving GAR clears ID only when FT on", func(t *testing.T) {
		existing := garExisting(wantID)

		ftOn := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		beforePreserve(t, uid, stack, existing, ftOn, true)
		assert.Empty(t, ftOn.Get(grafanaExternalIDJSONKey).MustString())

		ftOff := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		beforePreserve(t, uid, stack, existing, ftOff, false)
		assert.Equal(t, wantID, ftOff.Get(grafanaExternalIDJSONKey).MustString())
	})
}

// TestEnsureGrafanaExternalID_SigV4 covers create-time mint/scrub for SigV4 datasources
// (e.g. OpenSearch) that signal Grafana Assume Role via sigV4AuthType instead of authType.
// Per the design, SigV4 GAR uses the sigV4-prefixed key pair exclusively; unprefixed keys
// must never be set for this path.
func TestEnsureGrafanaExternalID_SigV4(t *testing.T) {
	const uid, stack = "dsUid1", "stackABC"

	t.Run("mints sigV4 keys for new SigV4 GAR datasources and does not touch native keys", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: grafanaAssumeRoleAuthType})
		beforeEnsure(t, uid, stack, jd, true)
		assert.True(t, isValidGrafanaExternalID(jd.Get(sigV4GrafanaExternalIDJSONKey).MustString(), stack, uid))
		assert.True(t, jd.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
		assert.Empty(t, jd.Get(usePerDatasourceExternalIDJSONKey).Interface())
	})

	t.Run("stack mode does not mint and discards client sigV4 ID on create", func(t *testing.T) {
		empty := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: false,
		})
		beforeEnsure(t, uid, stack, empty, true)
		assert.Empty(t, empty.Get(sigV4GrafanaExternalIDJSONKey).MustString())

		dormant := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: false,
			sigV4GrafanaExternalIDJSONKey:          buildGrafanaExternalID(stack, uid),
		})
		beforeEnsure(t, uid, stack, dormant, true)
		assert.Empty(t, dormant.Get(sigV4GrafanaExternalIDJSONKey).MustString())
	})

	t.Run("discards client-supplied sigV4 ID and mints a new one", func(t *testing.T) {
		pasted := buildGrafanaExternalID(stack, uid)
		jd := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          pasted,
		})
		beforeEnsure(t, uid, stack, jd, true)
		got := jd.Get(sigV4GrafanaExternalIDJSONKey).MustString()
		assert.True(t, isValidGrafanaExternalID(got, stack, uid))
		assert.NotEqual(t, pasted, got)
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("scrubs stolen sigV4GrafanaExternalId", func(t *testing.T) {
		stolen := stack + "-otherUid"
		jd := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:          grafanaAssumeRoleAuthType,
			sigV4GrafanaExternalIDJSONKey: stolen,
		})
		// FT off: scrub happens regardless, but no remint should occur, so the field stays empty.
		beforeEnsure(t, uid, stack, jd, false)
		assert.Empty(t, jd.Get(sigV4GrafanaExternalIDJSONKey).MustString())
	})
}

// TestPreserveGrafanaExternalID_SigV4 covers update-time preserve/scrub/clear for the SigV4
// (sigV4AuthType) path, mirroring TestPreserveGrafanaExternalID's native coverage.
func TestPreserveGrafanaExternalID_SigV4(t *testing.T) {
	const uid, stack = "dsUid1", "stackABC"
	wantID := buildGrafanaExternalID(stack, uid)

	t.Run("update omitting mode/ID preserves existing sigV4 values", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: grafanaAssumeRoleAuthType})
		beforePreserve(t, uid, stack, existing, updated, true)
		assert.Equal(t, wantID, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.True(t, updated.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("does not adopt a different valid client ID when stored sigV4 ID exists", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          wantID,
		})
		other := buildGrafanaExternalID(stack, uid)
		updated := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          other,
		})
		beforePreserve(t, uid, stack, existing, updated, true)
		assert.Equal(t, wantID, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("leaving SigV4 GAR clears sigV4GrafanaExternalId when FT on", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:          grafanaAssumeRoleAuthType,
			sigV4GrafanaExternalIDJSONKey: wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: "keys"})
		beforePreserve(t, uid, stack, existing, updated, true)
		assert.Empty(t, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("leaving SigV4 GAR keeps prefixed ID when FT off", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: "keys"})
		beforePreserve(t, uid, stack, existing, updated, false)
		assert.Equal(t, wantID, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.True(t, updated.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(usePerDatasourceExternalIDJSONKey).Interface())
	})

	t.Run("leaving GAR with auth type omitted still clears prefixed ID from payload", func(t *testing.T) {
		// Cloud/API/Terraform can send a partial jsonData blob that drops sigV4AuthType
		// while still including a previously minted prefixed ID.
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:          grafanaAssumeRoleAuthType,
			sigV4GrafanaExternalIDJSONKey: wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{
			sigV4GrafanaExternalIDJSONKey: wantID,
		})
		beforePreserve(t, uid, stack, existing, updated, true)
		assert.Empty(t, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("FT off with auth type omitted keeps ID on SigV4 keys not native", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{
			sigV4GrafanaExternalIDJSONKey: wantID,
		})
		beforePreserve(t, uid, stack, existing, updated, false)
		assert.Equal(t, wantID, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.True(t, updated.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(usePerDatasourceExternalIDJSONKey).Interface())
	})

	t.Run("FT off omit-auth restores SigV4 mode even when native mode key is set", func(t *testing.T) {
		// Cross-namespace restore must gate on the SigV4 mode key, not the native one that
		// externalIDKeys(updated) would select when sigV4AuthType is omitted.
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{
			usePerDatasourceExternalIDJSONKey: true,
		})
		beforePreserve(t, uid, stack, existing, updated, false)
		assert.Equal(t, wantID, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.True(t, updated.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("FT off omit-auth keeps explicit SigV4 mode on update", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{
			sigV4UsePerDatasourceExternalIDJSONKey: false,
		})
		beforePreserve(t, uid, stack, existing, updated, false)
		assert.Equal(t, wantID, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.False(t, updated.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("auth switch into SigV4 GAR mints unless stack mode is requested", func(t *testing.T) {
		keys := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: "keys"})

		mint := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: grafanaAssumeRoleAuthType})
		beforePreserve(t, uid, stack, keys, mint, true)
		assert.True(t, isValidGrafanaExternalID(mint.Get(sigV4GrafanaExternalIDJSONKey).MustString(), stack, uid))
		assert.True(t, mint.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
		assert.Empty(t, mint.Get(grafanaExternalIDJSONKey).MustString())

		stackMode := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: false,
		})
		beforePreserve(t, uid, stack, keys, stackMode, true)
		assert.Empty(t, stackMode.Get(sigV4GrafanaExternalIDJSONKey).MustString())
	})

	t.Run("legacy SigV4 GAR opts in and mints", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: grafanaAssumeRoleAuthType})
		updated := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
		})
		beforePreserve(t, uid, stack, existing, updated, true)
		assert.True(t, isValidGrafanaExternalID(updated.Get(sigV4GrafanaExternalIDJSONKey).MustString(), stack, uid))
		assert.True(t, updated.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})
}

// Cross-namespace update attacks: a client injects the inactive auth-type key, or an ID under
// the namespace its datasource does not use, to steer the mint or restore onto the wrong key
// pair. Payload IDs are always dropped, so what these cover is that the datasource ends up
// with the ID the server chose, under the keys it actually reads.
func TestPreserveGrafanaExternalID_CrossNamespace(t *testing.T) {
	const uid, stack = "dsUid1", "stackABC"

	t.Run("empty sigV4AuthType does not redirect a native mint onto the SigV4 keys", func(t *testing.T) {
		stolen := buildGrafanaExternalID(stack, uid)
		existing := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			sigV4AuthTypeJSONKey:              "",
			grafanaExternalIDJSONKey:          stolen,
			usePerDatasourceExternalIDJSONKey: true,
		})
		beforePreserve(t, uid, stack, existing, updated, true)

		got := updated.Get(grafanaExternalIDJSONKey).MustString()
		assert.True(t, isValidGrafanaExternalID(got, stack, uid))
		assert.NotEqual(t, stolen, got)
		assert.Empty(t, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
	})

	t.Run("empty sigV4AuthType still scrubs stolen native ID when FT off", func(t *testing.T) {
		stolen := buildGrafanaExternalID(stack, uid)
		existing := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			sigV4AuthTypeJSONKey:              "",
			grafanaExternalIDJSONKey:          stolen,
			usePerDatasourceExternalIDJSONKey: true,
		})
		beforePreserve(t, uid, stack, existing, updated, false)

		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
	})

	t.Run("decoy non-GAR sigV4AuthType clears stolen native ID and mints SigV4 namespace", func(t *testing.T) {
		stolen := buildGrafanaExternalID(stack, uid)
		existing := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			sigV4AuthTypeJSONKey:              "keys",
			grafanaExternalIDJSONKey:          stolen,
			usePerDatasourceExternalIDJSONKey: true,
		})
		beforePreserve(t, uid, stack, existing, updated, true)

		assert.NotEqual(t, stolen, updated.Get(grafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
		assert.True(t, isValidGrafanaExternalID(updated.Get(sigV4GrafanaExternalIDJSONKey).MustString(), stack, uid))
	})

	t.Run("switch into SigV4 GAR clears stolen native ID", func(t *testing.T) {
		stolen := buildGrafanaExternalID(stack, uid)
		existing := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: "keys"})
		updated := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey:               stolen,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
		})
		beforePreserve(t, uid, stack, existing, updated, true)

		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
		got := updated.Get(sigV4GrafanaExternalIDJSONKey).MustString()
		assert.True(t, isValidGrafanaExternalID(got, stack, uid))
		assert.NotEqual(t, stolen, got)
	})

	t.Run("SigV4 GAR update clears stolen native ID while preserving stored sigV4 ID", func(t *testing.T) {
		wantID := buildGrafanaExternalID(stack, uid)
		stolen := buildGrafanaExternalID(stack, uid)
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:          grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey:      stolen,
			sigV4GrafanaExternalIDJSONKey: stolen,
		})
		beforePreserve(t, uid, stack, existing, updated, true)

		assert.Equal(t, wantID, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("FT off SigV4 GAR update still clears stolen native ID", func(t *testing.T) {
		wantID := buildGrafanaExternalID(stack, uid)
		stolen := buildGrafanaExternalID(stack, uid)
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:     grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: stolen,
		})
		beforePreserve(t, uid, stack, existing, updated, false)

		assert.Equal(t, wantID, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})
}
