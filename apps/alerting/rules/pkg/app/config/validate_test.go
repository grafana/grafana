package config

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/validation"
)

func configWithUID(name, uid string) *v0alpha1.Config {
	c := &v0alpha1.Config{ObjectMeta: metav1.ObjectMeta{Name: name}}
	if uid != "" {
		c.Spec.ExternalRulerSync = &v0alpha1.ConfigV0alpha1SpecExternalRulerSync{DatasourceUid: &uid}
	}
	return c
}

func configWithPollInterval(pollInterval string) *v0alpha1.Config {
	c := &v0alpha1.Config{ObjectMeta: metav1.ObjectMeta{Name: v0alpha1.ConfigSingletonName}}
	c.Spec.ExternalRulerSync = &v0alpha1.ConfigV0alpha1SpecExternalRulerSync{PollInterval: &pollInterval}
	return c
}

func TestValidateConfigWrite(t *testing.T) {
	ctx := context.Background()

	t.Run("rejects a non-singleton name", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{Object: configWithUID("not-default", "")})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "singleton")
	})

	t.Run("validates the datasource on a change to a non-empty UID", func(t *testing.T) {
		var gotUID string
		fn := ValidateConfigWrite(RuntimeConfig{
			CheckExternalRulerSyncDatasource: func(_ context.Context, uid string) error {
				gotUID = uid
				return errors.New("boom")
			},
		})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object: configWithUID(v0alpha1.ConfigSingletonName, "ds-uid"),
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "externalRulerSync.datasourceUid")
		assert.Equal(t, "ds-uid", gotUID)
	})

	t.Run("skips validation when the UID is unchanged", func(t *testing.T) {
		called := false
		fn := ValidateConfigWrite(RuntimeConfig{
			CheckExternalRulerSyncDatasource: func(context.Context, string) error {
				called = true
				return errors.New("should not be called")
			},
		})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithUID(v0alpha1.ConfigSingletonName, "ds-uid"),
			OldObject: configWithUID(v0alpha1.ConfigSingletonName, "ds-uid"),
		})
		require.NoError(t, err)
		assert.False(t, called)
	})

	t.Run("clearing the UID is always allowed", func(t *testing.T) {
		called := false
		fn := ValidateConfigWrite(RuntimeConfig{
			CheckExternalRulerSyncDatasource: func(context.Context, string) error {
				called = true
				return errors.New("should not be called")
			},
		})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithUID(v0alpha1.ConfigSingletonName, ""),
			OldObject: configWithUID(v0alpha1.ConfigSingletonName, "ds-uid"),
		})
		require.NoError(t, err)
		assert.False(t, called)
	})

	t.Run("nil validator disables the datasource check", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object: configWithUID(v0alpha1.ConfigSingletonName, "ds-uid"),
		})
		require.NoError(t, err)
	})

	t.Run("rejects a pollInterval that isn't a valid PromDuration", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object: configWithPollInterval("5mn"),
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "externalRulerSync.pollInterval")
	})

	t.Run("allows a valid pollInterval", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object: configWithPollInterval("5m"),
		})
		require.NoError(t, err)
	})

	t.Run("rejects a pollInterval below the minimum", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object: configWithPollInterval("30s"),
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "externalRulerSync.pollInterval")
	})

	t.Run("rejects a pollInterval above the maximum", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object: configWithPollInterval("2h"),
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "externalRulerSync.pollInterval")
	})

	t.Run("allows the minimum pollInterval", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object: configWithPollInterval("1m"),
		})
		require.NoError(t, err)
	})

	t.Run("allows the maximum pollInterval", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object: configWithPollInterval("1h"),
		})
		require.NoError(t, err)
	})

	t.Run("allows an unset pollInterval", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object: configWithUID(v0alpha1.ConfigSingletonName, "ds-uid"),
		})
		require.NoError(t, err)
	})
}
