package pushurl

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUnstableSchemaFromValues(t *testing.T) {
	values := url.Values{}
	require.False(t, UnstableSchemaFromValues(values))
	values.Set(unstableSchemaParam, "yes")
	require.False(t, UnstableSchemaFromValues(values))
	values.Set(unstableSchemaParam, "true")
	require.True(t, UnstableSchemaFromValues(values))
	values.Set(unstableSchemaParam, "True")
	require.True(t, UnstableSchemaFromValues(values))
}

func TestFrameFormatFromValues(t *testing.T) {
	values := url.Values{}
	require.Equal(t, "labels_column", FrameFormatFromValues(values))
	values.Set(frameFormatParam, "wide")
	require.Equal(t, "wide", FrameFormatFromValues(values))
}
