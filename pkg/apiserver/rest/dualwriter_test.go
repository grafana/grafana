package rest

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestSetDualWritingMode(t *testing.T) {
	type testCase struct {
		name         string
		features     []any
		stackID      string
		expectedMode DualWriterMode
	}
	tests :=
		// #TODO add test cases for kv store failures. Requires adding support in kvstore test_utils.go
		[]testCase{
			{
				name:         "should return a mode 1 dual writer when no desired mode is set",
				features:     []any{},
				stackID:      "stack-1",
				expectedMode: Mode1,
			},
			{
				name:         "should return a mode 2 dual writer when mode 2 is set as the desired mode",
				features:     []any{featuremgmt.FlagDualWritePlaylistsMode2},
				stackID:      "stack-1",
				expectedMode: Mode2,
			},
		}

	for _, tt := range tests {
		l := (LegacyStorage)(nil)
		s := (Storage)(nil)
		m := &mock.Mock{}

		ls := legacyStoreMock{m, l}
		us := storageMock{m, s}

		f := featuremgmt.WithFeatures(tt.features...)
		kvStore := kvstore.WithNamespace(kvstore.NewFakeKVStore(), 0, "storage.dualwriting."+tt.stackID)

		key := "playlist"

		dw, err := SetDualWritingMode(context.Background(), kvStore, f, key, ls, us)
		assert.NoError(t, err)
		assert.Equal(t, tt.expectedMode, dw.Mode())

		// check kv store
		val, ok, err := kvStore.Get(context.Background(), key)
		assert.True(t, ok)
		assert.NoError(t, err)
		assert.Equal(t, val, fmt.Sprint(tt.expectedMode))
	}
}
