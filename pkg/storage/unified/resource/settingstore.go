package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/validation"
)

const (
	settingsSection = "unified/settings"
)

type settingStore struct {
	kv KV
}

type SettingKey struct {
	Namespace string
	Group     string
	Resource  string
}

func (k SettingKey) String() string {
	return fmt.Sprintf("%s/%s/%s", k.Group, k.Resource, k.Namespace)
}

func (k SettingKey) Validate() error {
	if k.Namespace == "" {
		return NewValidationError("namespace", k.Namespace, ErrNamespaceRequired)
	}
	if err := validation.IsValidGroup(k.Group); err != nil {
		return NewValidationError("group", k.Group, err[0])
	}
	if err := validation.IsValidResource(k.Resource); err != nil {
		return NewValidationError("resource", k.Resource, err[0])
	}
	return nil
}

type Setting struct {
	Namespace      string    `json:"namespace"`
	Group          string    `json:"group"`
	Resource       string    `json:"resource"`
	LastImportTime time.Time `json:"lastImportTime"`
}

func newSettingStore(kv KV) *settingStore {
	return &settingStore{
		kv: kv,
	}
}

func (d *settingStore) Get(ctx context.Context, key SettingKey) (Setting, error) {
	if err := key.Validate(); err != nil {
		return Setting{}, fmt.Errorf("invalid setting key: %w", err)
	}

	reader, err := d.kv.Get(ctx, settingsSection, key.String())
	if err != nil {
		return Setting{}, err
	}
	defer func() { _ = reader.Close() }()
	var setting Setting
	if err = json.NewDecoder(reader).Decode(&setting); err != nil {
		return Setting{}, err
	}
	return setting, nil
}

func (d *settingStore) Save(ctx context.Context, setting Setting) error {
	settingKey := SettingKey{
		Namespace: setting.Namespace,
		Group:     setting.Group,
		Resource:  setting.Resource,
	}

	if err := settingKey.Validate(); err != nil {
		return fmt.Errorf("invalid settingKey key: %w", err)
	}

	writer, err := d.kv.Save(ctx, settingsSection, settingKey.String())
	if err != nil {
		return err
	}
	encoder := json.NewEncoder(writer)
	if err := encoder.Encode(setting); err != nil {
		_ = writer.Close()
		return err
	}

	return writer.Close()
}
