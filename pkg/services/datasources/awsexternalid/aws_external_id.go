// Package awsexternalid manages server-minted per-datasource external IDs for Grafana
// Assume Role (GAR) datasources (native authType or SigV4 sigV4AuthType).
//
// Minting produces IDs of the form {stackExternalId}-{uid}-{16 hex} when
// awsAssumeRolePerDatasourceExternalId is enabled, auth is grafana_assume_role, stack ID and UID
// are configured, and the datasource is not explicitly in stack mode
// (usePerDatasourceExternalId / sigV4UsePerDatasourceExternalId false). On create, per-DS mode is
// the default when the flag is omitted. On update, mint only when switching into GAR or
// explicitly opting into per-DS mode; legacy GAR datasources without an ID stay on the stack ID
// until they opt in.
//
// Every save strips grafanaExternalId and sigV4GrafanaExternalId from the payload first; clients,
// the API, and provisioning cannot set them. What follows is restore from the stored row, mint,
// or leave empty (aws-sdk falls back to the stack ID at query time).
//
// The stored per-datasource ID is dropped from jsonData when the feature toggle is on and auth
// is no longer Grafana Assume Role (e.g. switching to access keys). Explicitly opting into stack
// mode (usePerDatasourceExternalId false) also clears the stored per-datasource ID so customers
// can retire the old IAM trust binding; opting back into per-datasource mode mints a fresh ID.
// Omitting the mode flag on update preserves the stored ID and mode (Terraform-friendly).
//
// When awsAssumeRolePerDatasourceExternalId is disabled, no new IDs are minted and leaving GAR
// does not clear a stored per-datasource ID. The toggle is a rollout kill-switch, not a signal
// to discard existing bindings — customers may already have a per-DS ID in their IAM trust policy.
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

	// SigV4 datasources that support Grafana Assume Role (e.g. OpenSearch) declare their auth
	// type in sigV4AuthType rather than authType, and keep their per-datasource ID pair under
	// these sigV4-prefixed keys instead of the unprefixed native ones.
	sigV4AuthTypeJSONKey                   = "sigV4AuthType"
	sigV4GrafanaExternalIDJSONKey          = "sigV4GrafanaExternalId"
	sigV4UsePerDatasourceExternalIDJSONKey = "sigV4UsePerDatasourceExternalId"
)

// BeforeSave mints or preserves the per-datasource grafanaExternalId of a Grafana Assume Role
// datasource. Pass existing=nil on create; pass the stored JsonData on update.
//
// Grafana Assume Role external IDs are server-owned: whatever a client, the API, or
// provisioning sends in grafanaExternalId / sigV4GrafanaExternalId is dropped up front, and only
// the stored value or a freshly minted one can take its place. (Other auth types, such as
// cross-account assume role, still use customer-entered externalId.) Whether a GAR datasource
// uses its own ID or the shared stack one is driven by usePerDatasourceExternalId, which
// aws-sdk only honours when explicitly true; an update that omits it keeps the stored value so
// partial (Terraform) updates do not change behaviour.
func BeforeSave(ctx context.Context, uid string, cfg *setting.Cfg, existing, jsonData *simplejson.Json) {
	if jsonData == nil {
		return
	}
	clearPayloadExternalIDs(jsonData)

	perDatasourceEnabled := awsAssumeRolePerDatasourceExternalIDEnabled(ctx)
	stackExternalID := ""
	if cfg != nil {
		stackExternalID = cfg.AWSExternalId
	}
	if existing == nil {
		mintOnCreate(uid, stackExternalID, jsonData, perDatasourceEnabled)
		return
	}
	resolveOnUpdate(uid, stackExternalID, existing, jsonData, perDatasourceEnabled)
}

// clearPayloadExternalIDs removes both native and SigV4 external ID keys from a save payload.
// What replaces them is up to the caller: the stored ID, a freshly minted one, or nothing at
// all, which leaves the datasource on the stack ID.
func clearPayloadExternalIDs(jsonData *simplejson.Json) {
	jsonData.Del(grafanaExternalIDJSONKey)
	jsonData.Del(sigV4GrafanaExternalIDJSONKey)
}

// buildGrafanaExternalID returns "{stackExternalId}-{dsUID}-{16 hex}". The hex suffix differs
// on every mint so delete→recreate with the same UID cannot reuse a prior IAM trust binding.
// It panics if the CSPRNG fails, since a guessable external ID would defeat the trust policy.
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

// externalIDKeys is the pair of jsonData keys holding a datasource's per-datasource external
// ID and the flag that turns it on. Both always come from the same namespace — native or
// SigV4-prefixed — so they travel as a unit.
type externalIDKeys struct {
	id   string
	mode string
}

var (
	nativeKeys = externalIDKeys{id: grafanaExternalIDJSONKey, mode: usePerDatasourceExternalIDJSONKey}
	sigV4Keys  = externalIDKeys{id: sigV4GrafanaExternalIDJSONKey, mode: sigV4UsePerDatasourceExternalIDJSONKey}
)

// externalIDKeysFor picks the namespace jsonData keeps its external ID in. A non-empty
// sigV4AuthType means SigV4: such a datasource signs with SigV4 for its whole life, so the
// namespace stays stable even when it leaves Grafana Assume Role (e.g. sigV4AuthType becomes
// "keys"). A present-but-empty value says nothing about the datasource, so it must not select
// SigV4: a payload could otherwise redirect the mint of a native datasource onto the SigV4
// keys, leaving it with no ID of its own and a stray one where it never looks.
func externalIDKeysFor(jsonData *simplejson.Json) externalIDKeys {
	if jsonData != nil {
		if v, exists := jsonData.CheckGet(sigV4AuthTypeJSONKey); exists && v.MustString() != "" {
			return sigV4Keys
		}
	}
	return nativeKeys
}

// usePerDatasourceExternalID reports whether jsonData sets its (native or SigV4-prefixed)
// per-datasource mode key and its value.
func usePerDatasourceExternalID(jsonData *simplejson.Json) (set bool, enabled bool) {
	if jsonData == nil {
		return false, false
	}
	v, exists := jsonData.CheckGet(externalIDKeysFor(jsonData).mode)
	if !exists {
		return false, false
	}
	return true, v.MustBool()
}

// payloadSetsStackMode reports whether jsonData explicitly sets the mode flag to false on keys,
// opting out of per-datasource IDs in favour of the shared stack external ID.
func payloadSetsStackMode(jsonData *simplejson.Json, keys externalIDKeys) bool {
	v, exists := jsonData.CheckGet(keys.mode)
	return exists && !v.MustBool()
}

// payloadSetsPerDatasourceMode reports whether jsonData explicitly sets the mode flag to true
// on keys, opting into per-datasource IDs.
func payloadSetsPerDatasourceMode(jsonData *simplejson.Json, keys externalIDKeys) bool {
	v, exists := jsonData.CheckGet(keys.mode)
	return exists && v.MustBool()
}

func mintGrafanaExternalID(uid, stackExternalID string, jsonData *simplejson.Json) {
	keys := externalIDKeysFor(jsonData)
	jsonData.Set(keys.id, buildGrafanaExternalID(stackExternalID, uid))
	// Mode must be true: aws-sdk uses the stack ID when the bool is unset/false, even if an ID is stored.
	jsonData.Set(keys.mode, true)
}

func awsAssumeRolePerDatasourceExternalIDEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx,
		featuremgmt.FlagAwsAssumeRolePerDatasourceExternalId, false, openfeature.TransactionContext(ctx))
}

// mintOnCreate mints a fresh ID for a new Grafana Assume Role datasource. BeforeSave has
// already dropped any ID the payload carried, so a datasource that does not qualify simply
// ends up without one and falls back to the stack ID.
func mintOnCreate(uid, stackExternalID string, jsonData *simplejson.Json, perDatasourceEnabled bool) {
	if !perDatasourceEnabled {
		return
	}
	if !isGrafanaAssumeRole(jsonData) || payloadSetsStackMode(jsonData, externalIDKeysFor(jsonData)) {
		return
	}
	if stackExternalID == "" || uid == "" {
		return
	}
	mintGrafanaExternalID(uid, stackExternalID, jsonData)
}

// resolveOnUpdate decides which external ID an updated datasource ends up with. BeforeSave has
// already stripped whatever the payload carried, so the outcome is one of three: restore the
// stored ID, mint a fresh one, or leave the datasource on the stack ID.
func resolveOnUpdate(uid, stackExternalID string, existing, updated *simplejson.Json, perDatasourceEnabled bool) {
	// updated replaces the stored jsonData wholesale, so a payload without Grafana Assume Role
	// auth — switched away, or simply omitting the auth type — saves a datasource that has no
	// business holding an external ID. Its ID is already gone from the payload, so returning
	// here is what drops it. Dropping is gated on the feature because it cannot be undone: a
	// later mint issues a new ID, which no longer matches the customer's IAM trust policy.
	if perDatasourceEnabled && !isGrafanaAssumeRole(updated) {
		return
	}

	// Explicit stack mode clears any stored per-datasource ID. The mode flag is read from the
	// update payload but keyed by the stored datasource's namespace — partial updates often
	// omit auth type, so the payload alone cannot select the right key pair. Omitting the mode
	// flag is not stack mode; an explicit false retires the old binding so customers can drop
	// it from IAM and get a fresh ID if they opt back in.
	if payloadSetsStackMode(updated, externalIDKeysFor(existing)) {
		return
	}

	// Restores read and write the stored datasource's namespace, never the payload's: a SigV4
	// datasource whose payload omits sigV4AuthType looks native here, and restoring its ID
	// onto the native keys would strand it where the datasource never reads it, silently
	// putting it back on the stack ID.
	stored := externalIDKeysFor(existing)
	storedID := ""
	if existing != nil {
		storedID = existing.Get(stored.id).MustString()
	}

	if canRestoreStoredID(storedID, stackExternalID, uid) {
		restoreStoredID(stored, storedID, existing, updated)
		return
	}

	if shouldMint(uid, stackExternalID, existing, updated, perDatasourceEnabled) {
		mintGrafanaExternalID(uid, stackExternalID, updated)
	}
}

// canRestoreStoredID reports whether a stored ID should survive the update. One that is not
// bound to this stack and datasource is dropped rather than re-applied, except when the stack
// ID or UID is missing: validation is impossible then, and a misconfigured AWSExternalId must
// not wipe a previously minted value.
func canRestoreStoredID(storedID, stackExternalID, uid string) bool {
	if isValidGrafanaExternalID(storedID, stackExternalID, uid) {
		return true
	}
	return storedID != "" && (stackExternalID == "" || uid == "")
}

// restoreStoredID copies the stored ID back onto the payload, along with the stored mode flag
// when the payload omits it. Partial updates (Terraform, API) routinely leave that flag out,
// and aws-sdk only uses the per-datasource ID when it is explicitly true, so dropping the flag
// would silently move the datasource back to the stack ID.
func restoreStoredID(stored externalIDKeys, storedID string, existing, updated *simplejson.Json) {
	updated.Set(stored.id, storedID)
	if _, payloadSetsMode := updated.CheckGet(stored.mode); payloadSetsMode {
		return
	}
	if storedModeSet, storedModeOn := usePerDatasourceExternalID(existing); storedModeSet {
		updated.Set(stored.mode, storedModeOn)
	}
}

// shouldMint reports whether an update with no restorable stored ID should get a fresh one.
func shouldMint(uid, stackExternalID string, existing, updated *simplejson.Json, perDatasourceEnabled bool) bool {
	if !perDatasourceEnabled || !isGrafanaAssumeRole(updated) {
		return false
	}
	if payloadSetsStackMode(updated, externalIDKeysFor(updated)) {
		return false
	}
	if stackExternalID == "" || uid == "" {
		return false
	}
	// Switching into Grafana Assume Role mints by default. A datasource already on Grafana
	// Assume Role has to ask, so legacy ones stay on the stack ID until they opt in.
	switchingIn := !isGrafanaAssumeRole(existing)
	return switchingIn || payloadSetsPerDatasourceMode(updated, externalIDKeysFor(updated))
}
