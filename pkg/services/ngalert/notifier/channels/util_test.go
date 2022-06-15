package channels

import (
	"context"
	"testing"

	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	store_error "github.com/grafana/grafana/pkg/services/ngalert/store/error"
)

func TestFirstImage(t *testing.T) {
	ctx := context.Background()
	images := &fakeImageStore{Images: []*models.Image{{
		Token: "foo",
	}, {
		Token: "bar",
	}}}

	// should return the image from the alert
	image, alert, err := firstImage(ctx, images, &types.Alert{
		Alert: model.Alert{
			Annotations: model.LabelSet{
				models.ScreenshotTokenAnnotation: "foo",
			},
		},
	})
	require.NoError(t, err)

	// should return the same alert
	require.NotNil(t, alert)
	assert.Equal(t, model.LabelValue("foo"), alert.Annotations[models.ScreenshotTokenAnnotation])

	// and the image should have the expected token
	require.NotNil(t, image)
	assert.Equal(t, "foo", image.Token)

	// should return the image from the first alert
	image, alert, err = firstImage(ctx, images, &types.Alert{
		Alert: model.Alert{
			Annotations: model.LabelSet{
				models.ScreenshotTokenAnnotation: "foo",
			},
		},
	}, &types.Alert{
		Alert: model.Alert{
			Annotations: model.LabelSet{
				models.ScreenshotTokenAnnotation: "bar",
			},
		},
	})
	require.NoError(t, err)

	// should return the expected alert
	require.NotNil(t, alert)
	assert.Equal(t, model.LabelValue("foo"), alert.Annotations[models.ScreenshotTokenAnnotation])

	// and the image should have the expected token
	require.NotNil(t, image)
	assert.Equal(t, "foo", image.Token)

	// should return the image for the second alert
	image, alert, err = firstImage(ctx, images, &types.Alert{
		Alert: model.Alert{
			Annotations: model.LabelSet{
				models.ScreenshotTokenAnnotation: "baz",
			},
		},
	}, &types.Alert{
		Alert: model.Alert{
			Annotations: model.LabelSet{
				models.ScreenshotTokenAnnotation: "bar",
			},
		},
	})
	require.NoError(t, err)

	// should return the same alert
	require.NotNil(t, alert)
	assert.Equal(t, model.LabelValue("bar"), alert.Annotations[models.ScreenshotTokenAnnotation])

	// and the image should have the expected token
	require.NotNil(t, image)
	assert.Equal(t, "bar", image.Token)

	// should return no images for unknown token
	image, alert, err = firstImage(ctx, images, &types.Alert{
		Alert: model.Alert{
			Annotations: model.LabelSet{
				models.ScreenshotTokenAnnotation: "baz",
			},
		},
	})
	require.Nil(t, err)
	require.Nil(t, alert)
	require.Nil(t, image)

	// should return no images
	image, alert, err = firstImage(ctx, images, &types.Alert{
		Alert: model.Alert{
			Annotations: model.LabelSet{},
		},
	})
	require.NoError(t, err)
	require.Nil(t, alert)
	require.Nil(t, image)
}

func TestGetImage(t *testing.T) {
	ctx := context.Background()
	images := &fakeImageStore{Images: []*models.Image{{
		Token: "foo",
	}}}

	// should return the image from the alert
	image, err := getImage(ctx, images, types.Alert{
		Alert: model.Alert{
			Annotations: model.LabelSet{
				models.ScreenshotTokenAnnotation: "foo",
			},
		},
	})
	require.NoError(t, err)
	require.NotNil(t, image)
	assert.Equal(t, "foo", image.Token)

	// should return ErrImageNotFound
	image, err = getImage(ctx, images, types.Alert{
		Alert: model.Alert{
			Annotations: model.LabelSet{
				models.ScreenshotTokenAnnotation: "bar",
			},
		},
	})
	assert.Equal(t, err, store_error.ErrImageNotFound)
	assert.Nil(t, image)

	// should return nil
	image, err = getImage(ctx, images, types.Alert{
		Alert: model.Alert{
			Annotations: model.LabelSet{},
		},
	})
	assert.Nil(t, err)
	assert.Nil(t, image)
}
