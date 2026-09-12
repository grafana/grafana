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

func configWithPromote(promote bool) *v0alpha1.Config {
	c := &v0alpha1.Config{ObjectMeta: metav1.ObjectMeta{Name: v0alpha1.ConfigSingletonName}}
	c.Spec.ExternalRulerSync = &v0alpha1.ConfigV0alpha1SpecExternalRulerSync{Promote: &promote}
	return c
}

func configWithPromotionCommittedStatus() *v0alpha1.Config {
	c := configWithPromote(true)
	c.Status.Conditions = []v0alpha1.ConfigCondition{{
		Type:   conditionTypeExternalRulerSynced,
		Reason: promotionCommittedReason,
	}}
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
			ValidateExternalRulerSyncDatasource: func(_ context.Context, uid string) error {
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
			ValidateExternalRulerSyncDatasource: func(context.Context, string) error {
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
			ValidateExternalRulerSyncDatasource: func(context.Context, string) error {
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

	t.Run("rejects reverting promote once promotion has committed", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithPromote(false),
			OldObject: configWithPromotionCommittedStatus(),
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "externalRulerSync.promote")
		assert.Contains(t, err.Error(), "one-way")
	})

	t.Run("allows re-affirming promote:true once promotion has committed", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithPromote(true),
			OldObject: configWithPromotionCommittedStatus(),
		})
		require.NoError(t, err)
	})

	t.Run("allows setting promote:false when promotion never committed", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithPromote(false),
			OldObject: configWithPromote(true), // requested, not yet committed
		})
		require.NoError(t, err)
	})

	t.Run("allows requesting promote:true for the first time", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{
			Object:    configWithPromote(true),
			OldObject: configWithUID(v0alpha1.ConfigSingletonName, "ds-uid"),
		})
		require.NoError(t, err)
	})
}
