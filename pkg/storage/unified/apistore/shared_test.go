package apistore

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSharedStorageValidate(t *testing.T) {
	tests := []struct {
		name    string
		shared  SharedStorage
		wantErr bool
	}{
		{name: "label", shared: SharedStorage{Group: "g", LabelKey: "k", LabelValue: "v"}},
		{name: "name", shared: SharedStorage{Group: "g", Name: &SharedName{Served: "a", Stored: "b"}}},
		{name: "unfiltered", shared: SharedStorage{Group: "g", Unfiltered: true}},
		{name: "nothing separates the groups", shared: SharedStorage{Group: "g"}, wantErr: true},
		{name: "unfiltered with a label", shared: SharedStorage{Group: "g", LabelKey: "k", LabelValue: "v", Unfiltered: true}, wantErr: true},
		{name: "unfiltered with a name", shared: SharedStorage{Group: "g", Name: &SharedName{Served: "a", Stored: "b"}, Unfiltered: true}, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.shared.validate()
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}
