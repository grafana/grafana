package models

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"math"
	"slices"
	"sort"
	"strings"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
)

// GetReceiverQuery represents a query for a single receiver.
type GetReceiverQuery struct {
	OrgID   int64
	Name    string
	Decrypt bool
}

// GetReceiversQuery represents a query for receiver groups.
type GetReceiversQuery struct {
	OrgID   int64
	Names   []string
	Limit   int
	Offset  int
	Decrypt bool
}

// ListReceiversQuery represents a query for listing receiver groups.
type ListReceiversQuery struct {
	OrgID  int64
	Names  []string
	Limit  int
	Offset int
}

// ReceiverMetadata contains metadata about a receiver's usage in routes and rules.
type ReceiverMetadata struct {
	InUseByRules  []AlertRuleKey
	InUseByRoutes int
}

// Receiver is the domain model representation of a receiver / contact point.
type Receiver struct {
	UID          string
	Name         string
	Integrations []*Integration
	Provenance   Provenance
	Version      string
}

func (r *Receiver) Clone() Receiver {
	clone := Receiver{
		UID:        r.UID,
		Name:       r.Name,
		Provenance: r.Provenance,
		Version:    r.Version,
	}

	if r.Integrations != nil {
		clone.Integrations = make([]*Integration, len(r.Integrations))
		for i, integration := range r.Integrations {
			cloneIntegration := integration.Clone()
			clone.Integrations[i] = &cloneIntegration
		}
	}
	return clone
}

// Encrypt encrypts all integrations.
func (r *Receiver) Encrypt(encryptFn EncryptFn) error {
	for _, integration := range r.Integrations {
		if err := integration.Encrypt(encryptFn); err != nil {
			return err
		}
	}
	return nil
}

// Decrypt decrypts all integrations.
func (r *Receiver) Decrypt(decryptFn DecryptFn) error {
	var errs []error
	for _, integration := range r.Integrations {
		if err := integration.Decrypt(decryptFn); err != nil {
			errs = append(errs, fmt.Errorf("failed to decrypt integration %s: %w", integration.UID, err))
		}
	}
	return errors.Join(errs...)
}

// Redact redacts all integrations.
func (r *Receiver) Redact(redactFn RedactFn) {
	for _, integration := range r.Integrations {
		integration.Redact(redactFn)
	}
}

// WithExistingSecureFields copies secure settings from an existing receivers for each integration. Which fields to copy
// is determined by the integrationSecureFields map, which contains a list of secure fields for each integration UID.
func (r *Receiver) WithExistingSecureFields(existing *Receiver, integrationSecureFields map[string][]string) {
	existingIntegrations := make(map[string]*Integration, len(existing.Integrations))
	for _, integration := range existing.Integrations {
		existingIntegrations[integration.UID] = integration
	}

	for _, integration := range r.Integrations {
		if integration.UID == "" {
			// This is a new integration, so we don't need to copy any secure fields.
			continue
		}
		fields := integrationSecureFields[integration.UID]
		if len(fields) > 0 {
			integration.WithExistingSecureFields(existingIntegrations[integration.UID], fields)
		}
	}
}

// Validate validates all integration settings, ensuring that the integrations are correctly configured.
func (r *Receiver) Validate(decryptFn DecryptFn) error {
	var errs []error
	for _, integration := range r.Integrations {
		if err := integration.Validate(decryptFn); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (r *Receiver) GetIntegrationTypes() []string {
	result := make([]string, 0, len(r.Integrations))
	for _, i := range r.Integrations {
		result = append(result, i.Config.Type)
	}
	return result
}

// Integration is the domain model representation of an integration.
type Integration struct {
	UID                   string
	Name                  string
	Config                IntegrationConfig
	DisableResolveMessage bool
	// Settings can contain both secure and non-secure settings either unencrypted or redacted.
	Settings map[string]any
	// SecureSettings can contain only secure settings either encrypted or redacted.
	SecureSettings map[string]string
}

// IntegrationConfig represents the configuration of an integration. It contains the type and information about the fields.
type IntegrationConfig struct {
	Type   string
	Fields map[string]IntegrationField
}

// IntegrationField represents a field in an integration configuration.
type IntegrationField struct {
	Name   string
	Fields map[string]IntegrationField
	Secure bool
}

type IntegrationFieldPath []string

func NewIntegrationFieldPath(path string) IntegrationFieldPath {
	return strings.Split(path, ".")
}

func (f IntegrationFieldPath) Head() string {
	if len(f) > 0 {
		return f[0]
	}
	return ""
}

func (f IntegrationFieldPath) Tail() IntegrationFieldPath {
	return f[1:]
}

func (f IntegrationFieldPath) IsLeaf() bool {
	return len(f) == 1
}

func (f IntegrationFieldPath) String() string {
	return strings.Join(f, ".")
}

func (f IntegrationFieldPath) Append(segment string) IntegrationFieldPath {
	return append(f, segment)
}

// IntegrationConfigFromType returns an integration configuration for a given integration type. If the integration type is
// not found an error is returned.
func IntegrationConfigFromType(integrationType string) (IntegrationConfig, error) {
	config, err := channels_config.ConfigForIntegrationType(integrationType)
	if err != nil {
		return IntegrationConfig{}, err
	}

	integrationConfig := IntegrationConfig{Type: config.Type, Fields: make(map[string]IntegrationField, len(config.Options))}

	for _, option := range config.Options {
		integrationConfig.Fields[option.PropertyName] = notifierOptionToIntegrationField(option)
	}
	return integrationConfig, nil
}

func notifierOptionToIntegrationField(option channels_config.NotifierOption) IntegrationField {
	f := IntegrationField{
		Name:   option.PropertyName,
		Secure: option.Secure,
		Fields: make(map[string]IntegrationField, len(option.SubformOptions)),
	}
	for _, subformOption := range option.SubformOptions {
		f.Fields[subformOption.PropertyName] = notifierOptionToIntegrationField(subformOption)
	}
	return f
}

// IsSecureField returns true if the field is both known and marked as secure in the integration configuration.
func (config *IntegrationConfig) IsSecureField(path IntegrationFieldPath) bool {
	f, ok := config.GetField(path)
	return ok && f.Secure
}

func (config *IntegrationConfig) GetField(path IntegrationFieldPath) (IntegrationField, bool) {
	for _, integrationField := range config.Fields {
		if strings.EqualFold(integrationField.Name, path.Head()) {
			if path.IsLeaf() {
				return integrationField, true
			}
			return integrationField.GetField(path.Tail())
		}
	}
	return IntegrationField{}, false
}

func (config *IntegrationConfig) GetSecretFields() []IntegrationFieldPath {
	return traverseFields(config.Fields, nil, func(i IntegrationField) bool {
		return i.Secure
	})
}

func traverseFields(flds map[string]IntegrationField, parentPath IntegrationFieldPath, predicate func(i IntegrationField) bool) []IntegrationFieldPath {
	var result []IntegrationFieldPath
	for key, field := range flds {
		if predicate(field) {
			result = append(result, parentPath.Append(key))
		}
		if len(field.Fields) > 0 {
			result = append(result, traverseFields(field.Fields, parentPath.Append(key), predicate)...)
		}
	}
	return result
}

func (config *IntegrationConfig) Clone() IntegrationConfig {
	clone := IntegrationConfig{
		Type: config.Type,
	}

	if len(config.Fields) > 0 {
		clone.Fields = make(map[string]IntegrationField, len(config.Fields))
		for key, field := range config.Fields {
			clone.Fields[key] = field.Clone()
		}
	}
	return clone
}

func (field *IntegrationField) GetField(path IntegrationFieldPath) (IntegrationField, bool) {
	for _, integrationField := range field.Fields {
		if strings.EqualFold(integrationField.Name, path.Head()) {
			if path.IsLeaf() {
				return integrationField, true
			}
			return integrationField.GetField(path.Tail())
		}
	}
	return IntegrationField{}, false
}

func (field *IntegrationField) Clone() IntegrationField {
	f := IntegrationField{
		Name:   field.Name,
		Secure: field.Secure,
		Fields: make(map[string]IntegrationField, len(field.Fields)),
	}
	for subName, sub := range field.Fields {
		f.Fields[subName] = sub.Clone()
	}
	return f
}

func (integration *Integration) Clone() Integration {
	return Integration{
		UID:                   integration.UID,
		Name:                  integration.Name,
		Config:                integration.Config.Clone(),
		DisableResolveMessage: integration.DisableResolveMessage,
		Settings:              cloneIntegrationSettings(integration.Settings),
		SecureSettings:        maps.Clone(integration.SecureSettings),
	}
}

// cloneIntegrationSettings implements a deep copy of settings map.
// It's not a generic purpose function because settings are limited to basic types, maps and slices.
func cloneIntegrationSettings(m map[string]any) map[string]any {
	result := maps.Clone(m) // do a shallow copy of the map first
	for k, v := range result {
		if mp, ok := v.(map[string]any); ok {
			result[k] = cloneIntegrationSettings(mp)
			continue
		}
		if mp, ok := v.([]any); ok {
			result[k] = cloneIntegrationSettingsSlice(mp)
			continue
		}
	}
	return result
}

// cloneIntegrationSettingsSlice implements a deep copy of a []any in integration settings.
// It's not a generic purpose function because settings are limited to basic types, maps and slices.
func cloneIntegrationSettingsSlice(src []any) []any {
	dst := slices.Clone(src)
	for i, v := range dst {
		if mp, ok := v.(map[string]any); ok {
			dst[i] = cloneIntegrationSettings(mp)
			continue
		}
		if mp, ok := v.([]any); ok {
			dst[i] = cloneIntegrationSettingsSlice(mp)
			continue
		}
	}
	return dst
}

// Encrypt encrypts all fields in Settings that are marked as secure in the integration configuration. The encrypted values
// are stored in SecureSettings and the original values are removed from Settings.
// If a field is already in SecureSettings it is not encrypted again.
func (integration *Integration) Encrypt(encryptFn EncryptFn) error {
	secretFieldPaths := integration.Config.GetSecretFields()
	if len(secretFieldPaths) == 0 {
		return nil
	}
	var errs []error
	for _, path := range secretFieldPaths {
		unencryptedSecureValue, ok, err := extractField(integration.Settings, path)
		if err != nil {
			errs = append(errs, fmt.Errorf("failed to extract secret field by path '%s': %w", path, err))
		}
		if !ok {
			continue
		}
		if _, exists := integration.SecureSettings[path.String()]; exists {
			continue
		}
		encrypted, err := encryptFn(unencryptedSecureValue)
		if err != nil {
			errs = append(errs, fmt.Errorf("failed to encrypt secure setting '%s': %w", path.String(), err))
		}
		integration.SecureSettings[path.String()] = encrypted
	}
	return errors.Join(errs...)
}

func extractField(settings map[string]any, path IntegrationFieldPath) (string, bool, error) {
	val, ok := settings[path.Head()]
	if !ok {
		return "", false, nil
	}
	if path.IsLeaf() {
		secret, ok := val.(string)
		if !ok {
			return "", false, fmt.Errorf("expected string but got %T", val)
		}
		delete(settings, path.Head())
		return secret, true, nil
	}
	sub, ok := val.(map[string]any)
	if !ok {
		return "", false, fmt.Errorf("expected nested object but got %T", val)
	}
	return extractField(sub, path.Tail())
}

func getFieldValue(settings map[string]any, path IntegrationFieldPath) (any, bool) {
	val, ok := settings[path.Head()]
	if !ok {
		return nil, false
	}
	if path.IsLeaf() {
		return val, true
	}
	sub, ok := val.(map[string]any)
	if !ok {
		return nil, false
	}
	return getFieldValue(sub, path.Tail())
}

func setField(settings map[string]any, path IntegrationFieldPath, valueFn func(current any) any, skipIfNotExist bool) error {
	if path.IsLeaf() {
		current, ok := settings[path.Head()]
		if skipIfNotExist && !ok {
			return nil
		}
		settings[path.Head()] = valueFn(current)
		return nil
	}
	val, ok := settings[path.Head()]
	if !ok {
		if skipIfNotExist {
			return nil
		}
		val = map[string]any{}
		settings[path.Head()] = val
	}
	sub, ok := val.(map[string]any)
	if !ok {
		return fmt.Errorf("expected nested object but got %T", val)
	}
	return setField(sub, path.Tail(), valueFn, skipIfNotExist)
}

// Decrypt decrypts all fields in SecureSettings and moves them to Settings.
// The original values are removed from SecureSettings.
func (integration *Integration) Decrypt(decryptFn DecryptFn) error {
	var errs []error
	for key, secureVal := range integration.SecureSettings {
		decrypted, err := decryptFn(secureVal)
		if err != nil {
			errs = append(errs, fmt.Errorf("failed to decrypt secure setting '%s': %w", key, err))
		}
		delete(integration.SecureSettings, key)

		path := NewIntegrationFieldPath(key)
		err = setField(integration.Settings, path, func(current any) any {
			return decrypted
		}, false)
		if err != nil {
			errs = append(errs, fmt.Errorf("failed to set field '%s': %w", key, err))
		}
	}
	return errors.Join(errs...)
}

// Redact redacts all fields in SecureSettings and moves them to Settings.
// The original values are removed from SecureSettings.
func (integration *Integration) Redact(redactFn RedactFn) {
	for _, path := range integration.Config.GetSecretFields() {
		_ = setField(integration.Settings, path, func(current any) any {
			if s, ok := current.(string); ok && s != "" {
				return redactFn(s)
			}
			return current
		}, true)
	}

	for key, secureVal := range integration.SecureSettings { // TODO: Should we trust that the receiver is stored correctly or use known secure settings?
		_ = setField(integration.Settings, NewIntegrationFieldPath(key), func(any) any {
			return redactFn(secureVal)
		}, false)
		delete(integration.SecureSettings, key)
	}
}

// WithExistingSecureFields copies secure settings from an existing integration. Which fields to copy is determined by the
// fields slice.
// Any fields found in Settings or SecureSettings are removed, even if they don't appear in the existing integration.
func (integration *Integration) WithExistingSecureFields(existing *Integration, fields []string) {
	// Now for each field marked as secure, we copy the value from the existing receiver.
	for _, secureField := range fields {
		delete(integration.Settings, secureField) // Ensure secure fields are removed from new settings and secure settings.
		delete(integration.SecureSettings, secureField)
		if existing != nil {
			if existingVal, ok := existing.SecureSettings[secureField]; ok {
				integration.SecureSettings[secureField] = existingVal
			}
		}
	}
}

// SecureFields returns a map of all secure fields in the integration. This includes fields in SecureSettings and fields
// in Settings that are marked as secure in the integration configuration.
func (integration *Integration) SecureFields() map[string]bool {
	secureFields := make(map[string]bool, len(integration.SecureSettings))
	if len(integration.SecureSettings) > 0 {
		for key := range integration.SecureSettings {
			secureFields[key] = true
		}
	}
	// We mark secure fields in the settings as well. This is to ensure legacy behaviour for redacted secure settings.
	for _, path := range integration.Config.GetSecretFields() {
		if secureFields[path.String()] {
			continue
		}
		value, ok := getFieldValue(integration.Settings, path)
		if !ok || value == nil {
			continue
		}
		if v, _ := value.(string); v != "" {
			secureFields[path.String()] = true
		}
	}

	return secureFields
}

// Validate validates the integration settings, ensuring that the integration is correctly configured.
func (integration *Integration) Validate(decryptFn DecryptFn) error {
	decrypted := integration.Clone()
	if err := decrypted.Decrypt(decryptFn); err != nil {
		return err
	}
	jsonBytes, err := json.Marshal(decrypted.Settings)
	if err != nil {
		return err
	}

	return ValidateIntegration(context.Background(), alertingNotify.GrafanaIntegrationConfig{
		UID:                   decrypted.UID,
		Name:                  decrypted.Name,
		Type:                  decrypted.Config.Type,
		DisableResolveMessage: decrypted.DisableResolveMessage,
		Settings:              jsonBytes,
		SecureSettings:        decrypted.SecureSettings,
	}, alertingNotify.NoopDecrypt)
}

func ValidateIntegration(ctx context.Context, integration alertingNotify.GrafanaIntegrationConfig, decryptFunc alertingNotify.GetDecryptedValueFn) error {
	if integration.Type == "" {
		return fmt.Errorf("type should not be an empty string")
	}
	if integration.Settings == nil {
		return fmt.Errorf("settings should not be empty")
	}

	_, err := alertingNotify.BuildReceiverConfiguration(ctx, &alertingNotify.APIReceiver{
		GrafanaIntegrations: alertingNotify.GrafanaIntegrations{
			Integrations: []*alertingNotify.GrafanaIntegrationConfig{&integration},
		},
	}, alertingNotify.DecodeSecretsFromBase64, decryptFunc)
	if err != nil {
		return err
	}
	return nil
}

type EncryptFn = func(string) (string, error)
type DecryptFn = func(string) (string, error)
type RedactFn = func(string) string

// Identified describes a class of resources that have a UID. Created to abstract required fields for authorization.
type Identified interface {
	GetUID() string
}

func (r *Receiver) GetUID() string {
	return r.UID
}

func NameToUid(name string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(name))
}

func (r *Receiver) Fingerprint() string {
	sum := newFingerprint()

	writeIntegration := func(in *Integration) {
		sum.writeString(in.UID)
		sum.writeString(in.Name)

		// Do not include fields in fingerprint as these are not part of the receiver definition.
		sum.writeString(in.Config.Type)

		sum.writeBool(in.DisableResolveMessage)

		// allocate a slice that will be used for sorting keys, so we allocate it only once
		var keys []string
		maxLen := int(math.Max(float64(len(in.Settings)), float64(len(in.SecureSettings))))
		if maxLen > 0 {
			keys = make([]string, maxLen)
		}

		writeSecureSettings := func(secureSettings map[string]string) {
			// maps do not guarantee predictable sequence of keys.
			// Therefore, to make hash stable, we need to sort keys
			if len(secureSettings) == 0 {
				return
			}
			idx := 0
			for k := range secureSettings {
				keys[idx] = k
				idx++
			}
			sub := keys[:idx]
			sort.Strings(sub)
			for _, name := range sub {
				sum.writeString(name)
				sum.writeString(secureSettings[name])
			}
		}
		writeSettings(sum, in.Settings)
		writeSecureSettings(in.SecureSettings)
	}

	// fields that determine the rule state
	sum.writeString(r.UID)
	sum.writeString(r.Name)
	sum.writeString(string(r.Provenance))

	for _, integration := range r.Integrations {
		writeIntegration(integration)
	}

	return sum.String()
}

func writeSettings(f fingerprint, m map[string]any) {
	if len(m) == 0 {
		f.writeBytes(nil)
		return
	}
	keysIter := maps.Keys(m)
	keys := slices.Collect(keysIter)
	sort.Strings(keys)
	for _, key := range keys {
		f.writeString(key)
		switch v := m[key].(type) {
		case string:
			f.writeString(v)
		case bool:
			f.writeBool(v)
		case float64: // unmarshalling to map[string]any represents all numbers as float64
			f.writeFloat64(v)
		case map[string]any:
			writeSettings(f, v)
		default:
			b, err := json.Marshal(v)
			if err != nil {
				f.writeString(fmt.Sprintf("%+v", v))
			}
			f.writeBytes(b)
		}
	}
}
