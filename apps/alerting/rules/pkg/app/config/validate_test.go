package config

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/validation"
)

func configNamed(name string) *v0alpha1.Config {
	return &v0alpha1.Config{ObjectMeta: metav1.ObjectMeta{Name: name}}
}

func TestValidateConfigWrite(t *testing.T) {
	ctx := context.Background()

	t.Run("rejects a non-singleton name", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{Object: configNamed("not-default")})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "singleton")
	})

	t.Run("allows a write to the singleton name", func(t *testing.T) {
		fn := ValidateConfigWrite(RuntimeConfig{})
		err := fn(ctx, validation.Request[*v0alpha1.Config]{Object: configNamed(v0alpha1.ConfigSingletonName)})
		require.NoError(t, err)
	})
}
