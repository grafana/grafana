package common

import (
	"testing"

	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestValidateDeleteCollectionRequest(t *testing.T) {
	selector := func(t *testing.T, s string) labels.Selector {
		t.Helper()
		sel, err := labels.Parse(s)
		require.NoError(t, err)
		return sel
	}

	t.Run("accepts a plain request and ordinary selectors", func(t *testing.T) {
		require.NoError(t, ValidateDeleteCollectionRequest(&internalversion.ListOptions{}))
		require.NoError(t, ValidateDeleteCollectionRequest(&internalversion.ListOptions{LabelSelector: selector(t, "a=b")}))
	})

	t.Run("rejects history and trash selectors", func(t *testing.T) {
		for _, key := range []string{utils.LabelKeyGetHistory, utils.LabelKeyGetTrash} {
			err := ValidateDeleteCollectionRequest(&internalversion.ListOptions{LabelSelector: selector(t, key+"=true")})
			require.True(t, k8serrors.IsBadRequest(err), "%s: got %v", key, err)
		}
	})

	t.Run("rejects malformed special selectors", func(t *testing.T) {
		err := ValidateDeleteCollectionRequest(&internalversion.ListOptions{LabelSelector: selector(t, utils.LabelKeyGetHistory+"=false")})
		require.True(t, k8serrors.IsBadRequest(err), "got %v", err)
	})
}
