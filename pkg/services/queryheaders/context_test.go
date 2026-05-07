package queryheaders

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWithForwardedFeatureNames(t *testing.T) {
	ctx := context.Background()
	require.Equal(t, "", ForwardedFeatureNamesCSV(ctx))

	ctx = WithForwardedFeatureNames(ctx, "a,b")
	require.Equal(t, "a,b", ForwardedFeatureNamesCSV(ctx))
}
