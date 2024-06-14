package rest

import (
	"context"
	"fmt"
	"testing"

	playlist "github.com/grafana/grafana/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestSetDualWritingMode(t *testing.T) {
	type testCase struct {
		name         string
		stackID      string
		desiredMode  DualWriterMode
		expectedMode DualWriterMode
	}
	tests :=
		// #TODO add test cases for kv store failures. Requires adding support in kvstore test_utils.go
		[]testCase{
			{
				name:         "should return a mode 2 dual writer when mode 2 is set as the desired mode",
				stackID:      "stack-1",
				desiredMode:  Mode2,
				expectedMode: Mode2,
			},
			{
				name:         "should return a mode 1 dual writer when mode 1 is set as the desired mode",
				stackID:      "stack-1",
				desiredMode:  Mode1,
				expectedMode: Mode1,
			},
		}

	for _, tt := range tests {
		l := (LegacyStorage)(nil)
		s := (Storage)(nil)
		m := &mock.Mock{}

		ls := legacyStoreMock{m, l}
		us := storageMock{m, s}

		kvStore := kvstore.WithNamespace(kvstore.NewFakeKVStore(), 0, "storage.dualwriting."+tt.stackID)

		p := prometheus.NewRegistry()
		dw, err := SetDualWritingMode(context.Background(), kvStore, ls, us, playlist.GROUPRESOURCE, tt.desiredMode, p)
		assert.NoError(t, err)
		assert.Equal(t, tt.expectedMode, dw.Mode())

		// check kv store
		val, ok, err := kvStore.Get(context.Background(), playlist.GROUPRESOURCE)
		assert.True(t, ok)
		assert.NoError(t, err)
		assert.Equal(t, val, fmt.Sprint(tt.expectedMode))
	}
}
