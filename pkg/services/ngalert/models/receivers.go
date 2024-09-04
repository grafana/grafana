package models

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"maps"
	"math"
	"sort"
	"unsafe"

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
	Secure bool
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
		integrationConfig.Fields[option.PropertyName] = IntegrationField{
			Name:   option.PropertyName,
			Secure: option.Secure,
		}
	}
	return integrationConfig, nil
}

// IsSecureField returns true if the field is both known and marked as secure in the integration configuration.
func (config *IntegrationConfig) IsSecureField(field string) bool {
	if config.Fields != nil {
		if f, ok := config.Fields[field]; ok {
			return f.Secure
		}
	}
	return false
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

func (field *IntegrationField) Clone() IntegrationField {
	return IntegrationField{
		Name:   field.Name,
		Secure: field.Secure,
	}
}

func (integration *Integration) Clone() Integration {
	return Integration{
		UID:                   integration.UID,
		Name:                  integration.Name,
		Config:                integration.Config.Clone(),
		DisableResolveMessage: integration.DisableResolveMessage,
		Settings:              maps.Clone(integration.Settings),
		SecureSettings:        maps.Clone(integration.SecureSettings),
	}
}

// Encrypt encrypts all fields in Settings that are marked as secure in the integration configuration. The encrypted values
// are stored in SecureSettings and the original values are removed from Settings.
// If a field is already in SecureSettings it is not encrypted again.
func (integration *Integration) Encrypt(encryptFn EncryptFn) error {
	var errs []error
	for key, val := range integration.Settings {
		if isSecureField := integration.Config.IsSecureField(key); !isSecureField {
			continue
		}

		delete(integration.Settings, key)
		unencryptedSecureValue, isString := val.(string)
		if !isString {
			continue
		}

		if _, exists := integration.SecureSettings[key]; exists {
			continue
		}

		encrypted, err := encryptFn(unencryptedSecureValue)
		if err != nil {
			errs = append(errs, fmt.Errorf("failed to encrypt secure setting '%s': %w", key, err))
		}

		integration.SecureSettings[key] = encrypted
	}

	return errors.Join(errs...)
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
		integration.Settings[key] = decrypted
	}

	return errors.Join(errs...)
}

// Redact redacts all fields in SecureSettings and moves them to Settings.
// The original values are removed from SecureSettings.
func (integration *Integration) Redact(redactFn RedactFn) {
	for key, secureVal := range integration.SecureSettings { // TODO: Should we trust that the receiver is stored correctly or use known secure settings?
		integration.Settings[key] = redactFn(secureVal)
		delete(integration.SecureSettings, key)
	}

	// We don't trust that the receiver is stored correctly, so we redact secure fields in the settings as well.
	for key, val := range integration.Settings {
		if val != "" && integration.Config.IsSecureField(key) {
			s, isString := val.(string)
			if !isString {
				continue
			}
			integration.Settings[key] = redactFn(s)
			delete(integration.SecureSettings, key)
		}
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
	for key, val := range integration.Settings {
		if val != "" && integration.Config.IsSecureField(key) {
			secureFields[key] = true
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
	}, decryptFunc)
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

func (r *Receiver) Fingerprint() string {
	sum := fnv.New64()

	writeBytes := func(b []byte) {
		_, _ = sum.Write(b)
		// add a byte sequence that cannot happen in UTF-8 strings.
		_, _ = sum.Write([]byte{255})
	}
	writeString := func(s string) {
		if len(s) == 0 {
			writeBytes(nil)
			return
		}
		// #nosec G103
		// avoid allocation when converting string to byte slice
		writeBytes(unsafe.Slice(unsafe.StringData(s), len(s)))
	}
	// this temp slice is used to convert ints to bytes.
	tmp := make([]byte, 8)
	writeInt := func(u int) {
		binary.LittleEndian.PutUint64(tmp, uint64(u))
		writeBytes(tmp)
	}

	writeIntegration := func(in *Integration) {
		writeString(in.UID)
		writeString(in.Name)

		// Do not include fields in fingerprint as these are not part of the receiver definition.
		writeString(in.Config.Type)

		if in.DisableResolveMessage {
			writeInt(1)
		} else {
			writeInt(0)
		}

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
				writeString(name)
				writeString(secureSettings[name])
			}
		}
		writeSecureSettings(in.SecureSettings)

		writeSettings := func(settings map[string]any) {
			// maps do not guarantee predictable sequence of keys.
			// Therefore, to make hash stable, we need to sort keys
			if len(settings) == 0 {
				return
			}
			idx := 0
			for k := range settings {
				keys[idx] = k
				idx++
			}
			sub := keys[:idx]
			sort.Strings(sub)
			for _, name := range sub {
				writeString(name)

				// TODO: Improve this.
				v := settings[name]
				bytes, err := json.Marshal(v)
				if err != nil {
					writeString(fmt.Sprintf("%+v", v))
				} else {
					writeBytes(bytes)
				}
			}
		}
		writeSettings(in.Settings)
	}

	// fields that determine the rule state
	writeString(r.UID)
	writeString(r.Name)
	writeString(string(r.Provenance))

	for _, integration := range r.Integrations {
		writeIntegration(integration)
	}

	return fmt.Sprintf("%016x", sum.Sum64())
}
