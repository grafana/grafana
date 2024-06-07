package utils_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestStrategy(t *testing.T) {
	t.Run("without folder support", func(t *testing.T) {
		testUser := &user.SignedInUser{UserID: 12343, UserUID: "abcd"}
		ctx := appcontext.WithUser(context.Background(), testUser)
		strategy := utils.NewGrafanaAppStrategy(nil, utils.ResourceOptions{
			// no folder, no nothing
		})

		// 1. Create a new object
		obj := &TestResource{
			ObjectMeta: v1.ObjectMeta{
				Name: "hello",
			},
		}
		errors := strategy.Validate(ctx, obj)
		require.Empty(t, errors)
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		require.Equal(t, testUser.GetUID().String(), meta.GetCreatedBy())
		require.Equal(t, "", meta.GetUpdatedBy())
		updated, err := meta.GetUpdatedTimestamp()
		require.NoError(t, err)
		require.Nil(t, updated)

		// 2. Update the object
		obj2 := obj.DeepCopy()
		obj2.Spec.Title = "a title"
		meta, err = utils.MetaAccessor(obj2)
		require.NoError(t, err)
		meta.SetCreatedBy("xxxx") // this should be ignored (and replaced)
		errors = strategy.ValidateUpdate(ctx, obj2, obj)
		require.Empty(t, errors)
		require.Equal(t, testUser.GetUID().String(), meta.GetCreatedBy()) // even though it was changed
		require.Equal(t, testUser.GetUID().String(), meta.GetUpdatedBy())
		updated, err = meta.GetUpdatedTimestamp()
		require.NoError(t, err)
		require.NotNil(t, updated)

		// // Folder support is not permitted
		// meta.SetFolder("xyz")
		// errors = strategy.Validate(ctx, obj)
		// require.Empty(t, errors)
	})
}
