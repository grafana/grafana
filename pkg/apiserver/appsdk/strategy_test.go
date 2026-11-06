package appsdk

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-app-sdk/resource"
)

func TestStrategyPrepareForCreateResetsStatusOnlyWhenAsked(t *testing.T) {
	kind := resource.Kind{
		Schema: resource.NewSimpleSchema("test.grafana.app", "v1", &resource.UntypedObject{}, &resource.UntypedList{}, resource.WithKind("Thing")),
	}
	newObj := func() *resource.UntypedObject {
		obj := &resource.UntypedObject{}
		obj.SetGeneration(7)
		return obj
	}

	t.Run("default keeps the object as sent", func(t *testing.T) {
		obj := newObj()
		newStrategy(runtime.NewScheme(), kind, StrategyOptions{}).PrepareForCreate(context.Background(), obj)
		require.Equal(t, int64(7), obj.GetGeneration())
	})

	t.Run("selected kinds start at generation 1", func(t *testing.T) {
		obj := newObj()
		opts := StrategyOptions{ResetStatusOnCreate: func(k string) bool { return k == "Thing" }}
		newStrategy(runtime.NewScheme(), kind, opts).PrepareForCreate(context.Background(), obj)
		require.Equal(t, int64(1), obj.GetGeneration())
	})

	t.Run("other kinds are left alone", func(t *testing.T) {
		obj := newObj()
		opts := StrategyOptions{ResetStatusOnCreate: func(k string) bool { return k == "Other" }}
		newStrategy(runtime.NewScheme(), kind, opts).PrepareForCreate(context.Background(), obj)
		require.Equal(t, int64(7), obj.GetGeneration())
	})
}
