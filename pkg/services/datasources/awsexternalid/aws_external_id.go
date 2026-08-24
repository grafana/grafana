package awsexternalid

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"regexp"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

const grafanaExternalIDHexBytes = 8

const (
	grafanaAssumeRoleAuthType         = "grafana_assume_role"
	grafanaExternalIDJSONKey          = "grafanaExternalId"
	usePerDatasourceExternalIDJSONKey = "usePerDatasourceExternalId"

	// SigV4 datasources (e.g. OpenSearch) that support Grafana Assume Role signal auth via
	// sigV4AuthType rather than authType, and store the per-datasource ID pair under these
	// sigV4-prefixed keys instead of the unprefixed native ones.
	sigV4AuthTypeJSONKey                   = "sigV4AuthType"
	sigV4GrafanaExternalIDJSONKey          = "sigV4GrafanaExternalId"
	sigV4UsePerDatasourceExternalIDJSONKey = "sigV4UsePerDatasourceExternalId"
)

// BeforeSave mints or preserves per-datasource grafanaExternalId on create/update.
// Pass existing=nil on create; pass the stored JsonData on update.
//
// Payload never carries external IDs: client/API/provisioning cannot set
// grafanaExternalId or sigV4GrafanaExternalId; those are cleared before create/update logic runs.
func BeforeSave(ctx context.Context, uid string, cfg *setting.Cfg, existing, jsonData *simplejson.Json) {
	allowGenerate := awsAssumeRolePerDatasourceExternalIDEnabled(ctx)
	stackExternalID := ""
	if cfg != nil {
		stackExternalID = cfg.AWSExternalId
	}
	clearPayloadExternalIDs(jsonData)
	if existing == nil {
		ensureGrafanaExternalID(uid, stackExternalID, jsonData, allowGenerate)
		return
	}
	preserveGrafanaExternalID(uid, stackExternalID, existing, jsonData, allowGenerate)
}

// clearPayloadExternalIDs removes both native and SigV4 external ID keys from a save payload.
// Callers must restore from existing or mint server-side afterward.
func clearPayloadExternalIDs(jsonData *simplejson.Json) {
	if jsonData == nil {
		return
	}
	jsonData.Del(grafanaExternalIDJSONKey)
	jsonData.Del(sigV4GrafanaExternalIDJSONKey)
}

// buildGrafanaExternalID returns "{stackExternalId}-{dsUID}-{16 hex}".
// The hex suffix makes the ID unique per mint so delete→recreate with the same UID
// cannot reuse a prior IAM trust binding.
func buildGrafanaExternalID(stackExternalID, datasourceUID string) string {
	var b [grafanaExternalIDHexBytes]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic("crypto/rand failed: " + err.Error())
	}
	return stackExternalID + "-" + datasourceUID + "-" + hex.EncodeToString(b[:])
}

// isValidGrafanaExternalID reports whether id is bound to this stack + datasource UID
// with a 16-char lowercase hex suffix.
func isValidGrafanaExternalID(id, stackExternalID, datasourceUID string) bool {
	if id == "" || stackExternalID == "" || datasourceUID == "" {
		return false
	}
	pattern := fmt.Sprintf("^%s-%s-[0-9a-f]{%d}$",
		regexp.QuoteMeta(stackExternalID), regexp.QuoteMeta(datasourceUID), grafanaExternalIDHexBytes*2)
	matched, err := regexp.MatchString(pattern, id)
	return err == nil && matched
}

// isGrafanaAssumeRole reports whether jsonData declares Grafana Assume Role auth, either via
// the native authType key or the SigV4-prefixed sigV4AuthType key used by SigV4 datasources
// (e.g. OpenSearch) that support Grafana Assume Role.
func isGrafanaAssumeRole(jsonData *simplejson.Json) bool {
	if jsonData == nil {
		return false
	}
	if jsonData.Get("authType").MustString() == grafanaAssumeRoleAuthType {
		return true
	}
	return jsonData.Get(sigV4AuthTypeJSONKey).MustString() == grafanaAssumeRoleAuthType
}

// externalIDKeys selects the per-datasource ID / mode key pair to operate on.
// A non-empty sigV4AuthType means the SigV4 key namespace — a datasource that signs with
// SigV4 keeps doing so, so the namespace stays stable when the datasource leaves Grafana
// Assume Role (e.g. sigV4AuthType becomes "keys"). An empty string is ignored so
// a spoofed `sigV4AuthType: ""` on a native datasource cannot redirect scrub/mint onto
// the SigV4 keys and leave an unvetted native grafanaExternalId behind.
func externalIDKeys(jsonData *simplejson.Json) (idKey, modeKey string) {
	if jsonData != nil {
		if v, exists := jsonData.CheckGet(sigV4AuthTypeJSONKey); exists && v.MustString() != "" {
			return sigV4GrafanaExternalIDJSONKey, sigV4UsePerDatasourceExternalIDJSONKey
		}
	}
	return grafanaExternalIDJSONKey, usePerDatasourceExternalIDJSONKey
}

// usePerDatasourceExternalID reports whether jsonData sets its (native or SigV4-prefixed)
// per-datasource mode key and its value.
func usePerDatasourceExternalID(jsonData *simplejson.Json) (set bool, enabled bool) {
	if jsonData == nil {
		return false, false
	}
	_, modeKey := externalIDKeys(jsonData)
	v, exists := jsonData.CheckGet(modeKey)
	if !exists {
		return false, false
	}
	return true, v.MustBool()
}

func mintGrafanaExternalID(uid, stackExternalID string, jsonData *simplejson.Json) {
	idKey, modeKey := externalIDKeys(jsonData)
	jsonData.Set(idKey, buildGrafanaExternalID(stackExternalID, uid))
	// Mode must be true: aws-sdk uses the stack ID when the bool is unset/false, even if an ID is stored.
	jsonData.Set(modeKey, true)
}

func awsAssumeRolePerDatasourceExternalIDEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx,
		featuremgmt.FlagAwsAssumeRolePerDatasourceExternalId, false, openfeature.TransactionContext(ctx))
}

// ensureGrafanaExternalID runs on create after BeforeSave clears payload external IDs.
// A fresh ID is minted into the active namespace when allowGenerate and per-DS Grafana
// Assume Role mode apply.
func ensureGrafanaExternalID(uid, stackExternalID string, jsonData *simplejson.Json, allowGenerate bool) {
	if jsonData == nil {
		return
	}

	if !allowGenerate {
		return
	}
	if !isGrafanaAssumeRole(jsonData) {
		return
	}

	modeSet, modeOn := usePerDatasourceExternalID(jsonData)
	if modeSet && !modeOn {
		return
	}

	if stackExternalID == "" || uid == "" {
		return
	}

	mintGrafanaExternalID(uid, stackExternalID, jsonData)
}

// preserveGrafanaExternalID runs on update after BeforeSave clears payload external IDs.
// A stored value is restored from existing or the server mints. Stack vs per-DS mode is
// controlled by usePerDatasourceExternalId (aws-sdk); switching to stack mode does not
// clear a stored ID.
// When allowGenerate is true it may mint when switching into grafana_assume_role or
// explicitly opting into per-DS mode, unless stack mode is requested.
//
// Omitting usePerDatasourceExternalId / grafanaExternalId on update preserves existing
// values (Terraform-friendly). The mode bool must be preserved too: aws-sdk only uses the
// per-DS ID when usePerDatasourceExternalId is explicitly true. Legacy GAR datasources
// without an ID stay on the stack ID until they opt in.
func preserveGrafanaExternalID(uid, stackExternalID string, existing, updated *simplejson.Json, allowGenerate bool) {
	if updated == nil {
		return
	}

	existingIsGAR := isGrafanaAssumeRole(existing)
	existingIdKey, _ := externalIDKeys(existing)
	existingID := ""
	if existing != nil {
		existingID = existing.Get(existingIdKey).MustString()
	}

	updatedIsGAR := isGrafanaAssumeRole(updated)
	idKey, modeKey := externalIDKeys(updated)
	modeSet, modeOn := usePerDatasourceExternalID(updated)

	// Leaving Grafana Assume Role with minting FT-enabled: BeforeSave already cleared the
	// payload IDs, so returning here is what drops the ID. With the FT off we fall through
	// and restore the stored value below.
	if allowGenerate && !updatedIsGAR {
		return
	}

	if isValidGrafanaExternalID(existingID, stackExternalID, uid) ||
		(existingID != "" && (stackExternalID == "" || uid == "")) {
		// Keep a validated ID, or any stored ID when we cannot validate (empty stack/uid)
		// so a misconfigured AWSExternalId does not wipe a previously minted value.
		//
		// Restore into the existing datasource's namespace when the update selected a
		// different one (e.g. FT-off path with auth type omitted → updated looks native
		// while existing is SigV4). Avoids copying a SigV4 ID onto the native keys.
		restoreIdKey, restoreModeKey := idKey, modeKey
		if existingIdKey != idKey {
			restoreIdKey = existingIdKey
			_, restoreModeKey = externalIDKeys(existing)
		}
		updated.Set(restoreIdKey, existingID)
		// When the update omits the mode flag in the restore namespace, restore the stored
		// value so Terraform/API updates that only send partial jsonData do not silently
		// fall back to stack ID. Check restoreModeKey (not updated's selected namespace) so
		// cross-namespace restores (FT off, auth type omitted) honor an explicit SigV4 mode
		// on the payload and are not blocked by a native mode key.
		if _, restoreModeSet := updated.CheckGet(restoreModeKey); !restoreModeSet {
			if existingModeSet, existingModeOn := usePerDatasourceExternalID(existing); existingModeSet {
				updated.Set(restoreModeKey, existingModeOn)
			}
		}
		return
	}
	// Invalid/empty stored ID is not re-applied; mint below when switching into GAR or opting in.

	if !allowGenerate {
		return
	}
	if !updatedIsGAR {
		return
	}
	if modeSet && !modeOn {
		return
	}
	if stackExternalID == "" || uid == "" {
		return
	}

	// Mint when switching into GAR (bool unset defaults to per-DS) or when explicitly opting in.
	switchingIn := !existingIsGAR
	optingIn := modeSet && modeOn
	if !switchingIn && !optingIn {
		return
	}

	mintGrafanaExternalID(uid, stackExternalID, updated)
}
