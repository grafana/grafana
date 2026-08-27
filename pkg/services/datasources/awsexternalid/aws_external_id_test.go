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

func beforeSaveCreate(t *testing.T, uid, stack string, jsonData *simplejson.Json, ftOn bool) {
	callBeforeSave(t, ftOn, uid, stack, nil, jsonData)
}

func beforeSaveUpdate(t *testing.T, uid, stack string, existing, updated *simplejson.Json, ftOn bool) {
	callBeforeSave(t, ftOn, uid, stack, existing, updated)
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
	const stack, uid = "stack123", "P7DC3E4760"
	id := buildGrafanaExternalID(stack, uid)
	assert.True(t, isValidGrafanaExternalID(id, stack, uid))
	assert.NotEqual(t, id, buildGrafanaExternalID(stack, uid)) // fresh hex suffix each mint
}

func TestIsValidGrafanaExternalID(t *testing.T) {
	const stack, uid = "stack123", "P7DC3E4760"
	id := buildGrafanaExternalID(stack, uid)
	assert.True(t, isValidGrafanaExternalID(id, stack, uid))
	assert.False(t, isValidGrafanaExternalID(id, "otherstack", uid))
	assert.False(t, isValidGrafanaExternalID(id, stack, "OTHERUID"))
	assert.False(t, isValidGrafanaExternalID(stack+"-"+uid, stack, uid))                     // no hex suffix
	assert.False(t, isValidGrafanaExternalID(stack+"-"+uid+"-abcd", stack, uid))             // short
	assert.False(t, isValidGrafanaExternalID(stack+"-"+uid+"-gggggggggggggggg", stack, uid)) // non-hex
}

func TestIsValidGrafanaExternalID_dashesInStackAndUID(t *testing.T) {
	stack, uid := "stacks-abc-1", "my-ds-uid"
	assert.True(t, isValidGrafanaExternalID(buildGrafanaExternalID(stack, uid), stack, uid))
}

func TestIsValidGrafanaExternalID_regexMetacharacters(t *testing.T) {
	stack, uid := "stack.1+2", "ds(uid)"
	assert.True(t, isValidGrafanaExternalID(buildGrafanaExternalID(stack, uid), stack, uid))
	// The stack ID and UID are matched literally, so an ID that only matches when they are
	// read as a pattern is rejected.
	assert.False(t, isValidGrafanaExternalID("stackX12-dsuid-0123456789abcdef", stack, uid))
}

func TestBeforeSave_create(t *testing.T) {
	const uid, stack = "dsUid1", "stackABC"
	stolen := stack + "-otherUid"

	t.Run("mints for new GAR datasources and sets mode true", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		beforeSaveCreate(t, uid, stack, jd, true)
		assert.True(t, isValidGrafanaExternalID(jd.Get(grafanaExternalIDJSONKey).MustString(), stack, uid))
		assert.True(t, jd.Get(usePerDatasourceExternalIDJSONKey).MustBool())
	})

	t.Run("stack mode does not mint", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: false,
		})
		beforeSaveCreate(t, uid, stack, jd, true)
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("stack mode discards a client ID rather than leaving it dormant", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: false,
			grafanaExternalIDJSONKey:          buildGrafanaExternalID(stack, uid),
		})
		beforeSaveCreate(t, uid, stack, jd, true)
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("discards client-supplied ID and mints a new one", func(t *testing.T) {
		pasted := buildGrafanaExternalID(stack, uid)
		jd := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: true,
			grafanaExternalIDJSONKey:          pasted,
		})
		beforeSaveCreate(t, uid, stack, jd, true)
		got := jd.Get(grafanaExternalIDJSONKey).MustString()
		assert.True(t, isValidGrafanaExternalID(got, stack, uid))
		assert.NotEqual(t, pasted, got)
	})

	t.Run("scrubs a stolen ID on non-GAR auth and leaves externalId alone", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{
			"authType":               "keys",
			"externalId":             "cross-account",
			grafanaExternalIDJSONKey: stolen,
		})
		beforeSaveCreate(t, uid, stack, jd, true)
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
		assert.Equal(t, "cross-account", jd.Get("externalId").MustString())
	})

	t.Run("does not mint when FT is off", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		beforeSaveCreate(t, uid, stack, jd, false)
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("discards client ID on create even when stack ID is empty", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: buildGrafanaExternalID(stack, uid),
		})
		beforeSaveCreate(t, uid, "", jd, true)
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("does not mint when the UID is unknown", func(t *testing.T) {
		// A UID is half of what binds an ID to this datasource, so there is nothing
		// meaningful to mint without one.
		jd := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		beforeSaveCreate(t, "", stack, jd, true)
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("two creates mint different hex suffixes for the same stack and uid", func(t *testing.T) {
		a := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		b := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		beforeSaveCreate(t, uid, stack, a, true)
		beforeSaveCreate(t, uid, stack, b, true)
		idA := a.Get(grafanaExternalIDJSONKey).MustString()
		idB := b.Get(grafanaExternalIDJSONKey).MustString()
		assert.True(t, isValidGrafanaExternalID(idA, stack, uid))
		assert.True(t, isValidGrafanaExternalID(idB, stack, uid))
		assert.NotEqual(t, idA, idB)
	})
}

func TestBeforeSave_update(t *testing.T) {
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

	t.Run("stack mode clears stored ID; omit preserves it", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: true,
			grafanaExternalIDJSONKey:          wantID,
		})

		t.Run("explicit stack mode", func(t *testing.T) {
			updated := simplejson.NewFromAny(map[string]any{
				"authType":                        grafanaAssumeRoleAuthType,
				usePerDatasourceExternalIDJSONKey: false,
			})
			beforeSaveUpdate(t, uid, stack, existing, updated, true)
			assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
			modeSet, modeOn := usePerDatasourceExternalID(updated)
			assert.True(t, modeSet)
			assert.False(t, modeOn)
		})

		t.Run("omit bool and ID", func(t *testing.T) {
			updated := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
			beforeSaveUpdate(t, uid, stack, existing, updated, true)
			assert.Equal(t, wantID, updated.Get(grafanaExternalIDJSONKey).MustString())
			modeSet, modeOn := usePerDatasourceExternalID(updated)
			assert.True(t, modeSet)
			assert.True(t, modeOn)
		})
	})

	t.Run("opting back into per-DS after stack mode mints a fresh ID", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: false,
		})
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: true,
		})
		beforeSaveUpdate(t, uid, stack, existing, updated, true)
		got := updated.Get(grafanaExternalIDJSONKey).MustString()
		assert.True(t, isValidGrafanaExternalID(got, stack, uid))
		assert.NotEqual(t, wantID, got)
	})

	t.Run("keeps stored ID when stack ID is empty", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: true,
			grafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		beforeSaveUpdate(t, uid, "", existing, updated, true)
		assert.Equal(t, wantID, updated.Get(grafanaExternalIDJSONKey).MustString())
		assert.True(t, updated.Get(usePerDatasourceExternalIDJSONKey).MustBool())
	})

	t.Run("restores existing after scrubbing a stolen update payload", func(t *testing.T) {
		existing := garExisting(wantID)
		updated := simplejson.NewFromAny(map[string]any{
			"authType":               grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: stolen,
		})
		beforeSaveUpdate(t, uid, stack, existing, updated, true)
		assert.Equal(t, wantID, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("does not re-apply an invalid stored ID", func(t *testing.T) {
		updated := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		beforeSaveUpdate(t, uid, stack, garExisting(stolen), updated, true)
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("does not auto-migrate legacy GAR on an ordinary update", func(t *testing.T) {
		updated := simplejson.NewFromAny(map[string]any{
			"authType":      grafanaAssumeRoleAuthType,
			"assumeRoleArn": "arn:aws:iam::123:role/x",
		})
		beforeSaveUpdate(t, uid, stack, garExisting(""), updated, true)
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("legacy GAR opting in mints a fresh ID rather than adopting the client's", func(t *testing.T) {
		existing := garExisting("")
		clientPaste := buildGrafanaExternalID(stack, uid)
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: true,
			grafanaExternalIDJSONKey:          clientPaste,
		})
		beforeSaveUpdate(t, uid, stack, existing, updated, true)
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
		beforeSaveUpdate(t, uid, stack, existing, updated, true)
		assert.Equal(t, wantID, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("auth switch into GAR mints", func(t *testing.T) {
		keys := simplejson.NewFromAny(map[string]any{
			"authType":   "keys",
			"externalId": "cross-account-id",
		})
		updated := simplejson.NewFromAny(map[string]any{
			"authType":   grafanaAssumeRoleAuthType,
			"externalId": "cross-account-id",
		})
		beforeSaveUpdate(t, uid, stack, keys, updated, true)
		assert.True(t, isValidGrafanaExternalID(updated.Get(grafanaExternalIDJSONKey).MustString(), stack, uid))
		assert.Equal(t, "cross-account-id", updated.Get("externalId").MustString())
	})

	t.Run("auth switch into GAR does not mint when stack mode is requested", func(t *testing.T) {
		keys := simplejson.NewFromAny(map[string]any{
			"authType":   "keys",
			"externalId": "cross-account-id",
		})
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: false,
			"externalId":                      "cross-account-id",
		})
		beforeSaveUpdate(t, uid, stack, keys, updated, true)
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("leaving GAR clears the ID when FT on", func(t *testing.T) {
		updated := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		beforeSaveUpdate(t, uid, stack, garExisting(wantID), updated, true)
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("leaving GAR keeps the stored ID when FT off", func(t *testing.T) {
		updated := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		beforeSaveUpdate(t, uid, stack, garExisting(wantID), updated, false)
		assert.Equal(t, wantID, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("keeps the stored ID when the UID is unknown", func(t *testing.T) {
		// The stored ID cannot be validated without a UID, and a save must not wipe a
		// previously minted value on the strength of a check it could not run.
		existing := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: true,
			grafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		beforeSaveUpdate(t, "", stack, existing, updated, true)
		assert.Equal(t, wantID, updated.Get(grafanaExternalIDJSONKey).MustString())
		assert.True(t, updated.Get(usePerDatasourceExternalIDJSONKey).MustBool())
	})

	t.Run("does not mint on switch into GAR when the stack ID is empty", func(t *testing.T) {
		// No stored ID to fall back on, so this reaches the mint decision rather than the
		// restore. Minting here would build an ID with an empty stack prefix.
		existing := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		updated := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		beforeSaveUpdate(t, uid, "", existing, updated, true)
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("does not mint on switch into GAR when the UID is unknown", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		updated := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		beforeSaveUpdate(t, "", stack, existing, updated, true)
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("FT off does not mint on auth switch into GAR", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		updated := simplejson.NewFromAny(map[string]any{"authType": grafanaAssumeRoleAuthType})
		beforeSaveUpdate(t, uid, stack, existing, updated, false)
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("FT off does not mint when legacy GAR opts in", func(t *testing.T) {
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			usePerDatasourceExternalIDJSONKey: true,
		})
		beforeSaveUpdate(t, uid, stack, garExisting(""), updated, false)
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})
}

// TestBeforeSave_createSigV4 covers create-time mint/scrub for SigV4 datasources
// (e.g. OpenSearch) that signal Grafana Assume Role via sigV4AuthType instead of authType.
// Per the design, SigV4 GAR uses the sigV4-prefixed key pair exclusively; unprefixed keys
// must never be set for this path.
func TestBeforeSave_createSigV4(t *testing.T) {
	const uid, stack = "dsUid1", "stackABC"

	t.Run("mints sigV4 keys for new SigV4 GAR datasources and does not touch native keys", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: grafanaAssumeRoleAuthType})
		beforeSaveCreate(t, uid, stack, jd, true)
		assert.True(t, isValidGrafanaExternalID(jd.Get(sigV4GrafanaExternalIDJSONKey).MustString(), stack, uid))
		assert.True(t, jd.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
		assert.Empty(t, jd.Get(grafanaExternalIDJSONKey).MustString())
		assert.Empty(t, jd.Get(usePerDatasourceExternalIDJSONKey).Interface())
	})

	t.Run("stack mode does not mint sigV4 keys", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: false,
		})
		beforeSaveCreate(t, uid, stack, jd, true)
		assert.Empty(t, jd.Get(sigV4GrafanaExternalIDJSONKey).MustString())
	})

	t.Run("stack mode discards a client sigV4 ID rather than leaving it dormant", func(t *testing.T) {
		jd := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: false,
			sigV4GrafanaExternalIDJSONKey:          buildGrafanaExternalID(stack, uid),
		})
		beforeSaveCreate(t, uid, stack, jd, true)
		assert.Empty(t, jd.Get(sigV4GrafanaExternalIDJSONKey).MustString())
	})

	t.Run("discards client-supplied sigV4 ID and mints a new one", func(t *testing.T) {
		pasted := buildGrafanaExternalID(stack, uid)
		jd := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          pasted,
		})
		beforeSaveCreate(t, uid, stack, jd, true)
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
		beforeSaveCreate(t, uid, stack, jd, false)
		assert.Empty(t, jd.Get(sigV4GrafanaExternalIDJSONKey).MustString())
	})
}

// TestBeforeSave_updateSigV4 covers update-time preserve/scrub/clear for the SigV4
// (sigV4AuthType) path, mirroring TestBeforeSave_update's native coverage.
func TestBeforeSave_updateSigV4(t *testing.T) {
	const uid, stack = "dsUid1", "stackABC"
	wantID := buildGrafanaExternalID(stack, uid)

	t.Run("update omitting mode/ID preserves existing sigV4 values", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: grafanaAssumeRoleAuthType})
		beforeSaveUpdate(t, uid, stack, existing, updated, true)
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
		beforeSaveUpdate(t, uid, stack, existing, updated, true)
		assert.Equal(t, wantID, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("leaving SigV4 GAR clears sigV4GrafanaExternalId when FT on", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:          grafanaAssumeRoleAuthType,
			sigV4GrafanaExternalIDJSONKey: wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: "keys"})
		beforeSaveUpdate(t, uid, stack, existing, updated, true)
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
		beforeSaveUpdate(t, uid, stack, existing, updated, false)
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
		beforeSaveUpdate(t, uid, stack, existing, updated, true)
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
		beforeSaveUpdate(t, uid, stack, existing, updated, false)
		assert.Equal(t, wantID, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.True(t, updated.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(usePerDatasourceExternalIDJSONKey).Interface())
	})

	t.Run("FT off omit-auth restores SigV4 mode even when native mode key is set", func(t *testing.T) {
		// Cross-namespace restore must gate on the SigV4 mode key, not the native one that
		// externalIDKeysFor(updated) would select when sigV4AuthType is omitted.
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{
			usePerDatasourceExternalIDJSONKey: true,
		})
		beforeSaveUpdate(t, uid, stack, existing, updated, false)
		assert.Equal(t, wantID, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.True(t, updated.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("explicit stack mode clears stored sigV4 ID", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: false,
		})
		beforeSaveUpdate(t, uid, stack, existing, updated, true)
		assert.Empty(t, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.False(t, updated.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
	})

	t.Run("FT off explicit stack mode still clears stored sigV4 ID", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{
			sigV4UsePerDatasourceExternalIDJSONKey: false,
		})
		beforeSaveUpdate(t, uid, stack, existing, updated, false)
		assert.Empty(t, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.False(t, updated.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("auth switch into SigV4 GAR mints", func(t *testing.T) {
		keys := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: "keys"})
		updated := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: grafanaAssumeRoleAuthType})
		beforeSaveUpdate(t, uid, stack, keys, updated, true)
		assert.True(t, isValidGrafanaExternalID(updated.Get(sigV4GrafanaExternalIDJSONKey).MustString(), stack, uid))
		assert.True(t, updated.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("auth switch into SigV4 GAR does not mint when stack mode is requested", func(t *testing.T) {
		keys := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: "keys"})
		updated := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: false,
		})
		beforeSaveUpdate(t, uid, stack, keys, updated, true)
		assert.Empty(t, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
	})

	t.Run("legacy SigV4 GAR opts in and mints", func(t *testing.T) {
		existing := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: grafanaAssumeRoleAuthType})
		updated := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
		})
		beforeSaveUpdate(t, uid, stack, existing, updated, true)
		assert.True(t, isValidGrafanaExternalID(updated.Get(sigV4GrafanaExternalIDJSONKey).MustString(), stack, uid))
		assert.True(t, updated.Get(sigV4UsePerDatasourceExternalIDJSONKey).MustBool())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})
}

// Cross-namespace update attacks: a client injects the inactive auth-type key, or an ID under
// the namespace its datasource does not use, to steer the mint or restore onto the wrong key
// pair. Payload IDs are always dropped, so what these cover is that the datasource ends up
// with the ID the server chose, under the keys it actually reads.
func TestBeforeSave_updateCrossNamespace(t *testing.T) {
	const uid, stack = "dsUid1", "stackABC"

	t.Run("empty sigV4AuthType does not redirect a native mint onto the SigV4 keys", func(t *testing.T) {
		injected := buildGrafanaExternalID(stack, uid)
		existing := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			sigV4AuthTypeJSONKey:              "",
			grafanaExternalIDJSONKey:          injected,
			usePerDatasourceExternalIDJSONKey: true,
		})
		beforeSaveUpdate(t, uid, stack, existing, updated, true)

		got := updated.Get(grafanaExternalIDJSONKey).MustString()
		assert.True(t, isValidGrafanaExternalID(got, stack, uid))
		assert.NotEqual(t, injected, got)
		assert.Empty(t, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
	})

	t.Run("empty sigV4AuthType still drops the injected native ID when FT off", func(t *testing.T) {
		injected := buildGrafanaExternalID(stack, uid)
		existing := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			sigV4AuthTypeJSONKey:              "",
			grafanaExternalIDJSONKey:          injected,
			usePerDatasourceExternalIDJSONKey: true,
		})
		beforeSaveUpdate(t, uid, stack, existing, updated, false)

		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
	})

	t.Run("decoy non-GAR sigV4AuthType drops the injected native ID and mints on the SigV4 keys", func(t *testing.T) {
		injected := buildGrafanaExternalID(stack, uid)
		existing := simplejson.NewFromAny(map[string]any{"authType": "keys"})
		updated := simplejson.NewFromAny(map[string]any{
			"authType":                        grafanaAssumeRoleAuthType,
			sigV4AuthTypeJSONKey:              "keys",
			grafanaExternalIDJSONKey:          injected,
			usePerDatasourceExternalIDJSONKey: true,
		})
		beforeSaveUpdate(t, uid, stack, existing, updated, true)

		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
		assert.True(t, isValidGrafanaExternalID(updated.Get(sigV4GrafanaExternalIDJSONKey).MustString(), stack, uid))
	})

	t.Run("switch into SigV4 GAR drops the injected native ID", func(t *testing.T) {
		injected := buildGrafanaExternalID(stack, uid)
		existing := simplejson.NewFromAny(map[string]any{sigV4AuthTypeJSONKey: "keys"})
		updated := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey:               injected,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
		})
		beforeSaveUpdate(t, uid, stack, existing, updated, true)

		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
		got := updated.Get(sigV4GrafanaExternalIDJSONKey).MustString()
		assert.True(t, isValidGrafanaExternalID(got, stack, uid))
		assert.NotEqual(t, injected, got)
	})

	t.Run("SigV4 GAR update drops the injected native ID and keeps the stored sigV4 ID", func(t *testing.T) {
		wantID := buildGrafanaExternalID(stack, uid)
		injected := buildGrafanaExternalID(stack, uid)
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:          grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey:      injected,
			sigV4GrafanaExternalIDJSONKey: injected,
		})
		beforeSaveUpdate(t, uid, stack, existing, updated, true)

		assert.Equal(t, wantID, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})

	t.Run("FT off SigV4 GAR update still drops the injected native ID", func(t *testing.T) {
		wantID := buildGrafanaExternalID(stack, uid)
		injected := buildGrafanaExternalID(stack, uid)
		existing := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:                   grafanaAssumeRoleAuthType,
			sigV4UsePerDatasourceExternalIDJSONKey: true,
			sigV4GrafanaExternalIDJSONKey:          wantID,
		})
		updated := simplejson.NewFromAny(map[string]any{
			sigV4AuthTypeJSONKey:     grafanaAssumeRoleAuthType,
			grafanaExternalIDJSONKey: injected,
		})
		beforeSaveUpdate(t, uid, stack, existing, updated, false)

		assert.Equal(t, wantID, updated.Get(sigV4GrafanaExternalIDJSONKey).MustString())
		assert.Empty(t, updated.Get(grafanaExternalIDJSONKey).MustString())
	})
}
