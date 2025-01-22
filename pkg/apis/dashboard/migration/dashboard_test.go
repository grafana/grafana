package migration

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMarshalJSON(t *testing.T) {
	tests := []struct {
		name    string
		input   DashboardSpec
		want    string
		wantErr bool
	}{
		{
			name: "valid struct",
			input: DashboardSpec{
				Refresh:       "10s",
				SchemaVersion: 40,
				Title:         "Test Dashboard",
				unstructured: Unstructured{
					"refresh":       true,
					"schemaVersion": 30,
					"title":         "Something Else",
					"panels":        []interface{}{},
				},
			},
			want:    `{"refresh":"10s","schemaVersion":40,"title":"Test Dashboard", "panels":[]}`,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.input.MarshalJSON()
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			require.JSONEq(t, tt.want, string(got))
		})
	}
}

func TestUnmarshalJSON(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    DashboardSpec
		wantErr bool
	}{
		{
			name: "valid JSON",
			input: `{
				"refresh": true,
				"schemaVersion": 39,
				"title": "Test Dashboard",
				"panels": []
			}`,
			want: DashboardSpec{
				Refresh:       "",
				SchemaVersion: 40,
				Title:         "Test Dashboard",
				unstructured: Unstructured{
					"refresh":       true,
					"schemaVersion": 39,
					"title":         "Test Dashboard",
					"panels":        []interface{}{},
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var got DashboardSpec
			err := got.UnmarshalJSON([]byte(tt.input))
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.want, got)
			}
		})
	}
}
