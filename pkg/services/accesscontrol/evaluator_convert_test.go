package accesscontrol

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEvaluatorDTO_UnmarshalJSON(t *testing.T) {
	tests := []struct {
		name    string
		data    []byte
		want    EvaluatorDTO
		wantErr bool
	}{
		{
			name:    "nil",
			data:    nil,
			wantErr: true,
		},
		{
			name:    "empty",
			data:    []byte{},
			wantErr: true,
		},
		{
			name: "perm eval",
			data: []byte(`{"action": "users:read", "scopes": ["users:*", "org.users:*"]}`),
			want: EvaluatorDTO{
				Ev: permissionEvaluator{Action: "users:read", Scopes: []string{"users:*", "org.users:*"}},
			},
			wantErr: false,
		},
		{
			name:    "perm eval without scopes",
			data:    []byte(`{"action": "users:read"}`),
			want:    EvaluatorDTO{Ev: permissionEvaluator{Action: "users:read"}},
			wantErr: false,
		},
		{
			name:    "no action in perm eval",
			data:    []byte(`{"act": "users:read", "scopes": ["users:*", "org.users:*"]}`),
			wantErr: true,
		},
		{
			name:    "action is not a string in perm eval",
			data:    []byte(`{"action": ["users:read"], "scopes": ["users:*", "org.users:*"]}`),
			wantErr: true,
		},
		{
			name:    "scopes is not a list in perm eval",
			data:    []byte(`{"action": "users:read", "scopes": "users:*"}`),
			wantErr: true,
		},
		{
			name:    "scope is not a string in perm eval",
			data:    []byte(`{"action": "users:read", "scopes": ["users:*", ["org.users:*"]]}`),
			wantErr: true,
		},
		{
			name: "any eval",
			data: []byte(`{"any": [
				{"action": "users:read", "scopes": ["users:*", "org.users:*"]},
				{"action": "teams:read", "scopes": ["teams:*"]}
			]}`),
			want: EvaluatorDTO{
				Ev: anyEvaluator{anyOf: []Evaluator{
					permissionEvaluator{Action: "users:read", Scopes: []string{"users:*", "org.users:*"}},
					permissionEvaluator{Action: "teams:read", Scopes: []string{"teams:*"}},
				}},
			},
			wantErr: false,
		},
		{
			name:    "no list in any eval",
			data:    []byte(`{"any": {"action": "users:read", "scopes": ["users:*", "org.users:*"]}}`),
			wantErr: true,
		},
		{
			name: "incorrect type in any eval",
			data: []byte(`{"any": [
				{"action": "users:read", "scopes": ["users:*", "org.users:*"]},
				"action"
			]}`),
			wantErr: true,
		},
		{
			name: "all eval",
			data: []byte(`{"all": [
				{"action": "users:read", "scopes": ["users:*", "org.users:*"]},
				{"action": "teams:read", "scopes": ["teams:*"]}
			]}`),
			want: EvaluatorDTO{
				Ev: allEvaluator{allOf: []Evaluator{
					permissionEvaluator{Action: "users:read", Scopes: []string{"users:*", "org.users:*"}},
					permissionEvaluator{Action: "teams:read", Scopes: []string{"teams:*"}},
				}},
			},
			wantErr: false,
		},
		{
			name: "complex eval",
			data: []byte(`{"any": [
				{"all": [
					{"action": "users:read", "scopes": ["users:id:1", "org.users:id:1"]},
					{"action": "teams:read", "scopes": ["teams:id:2"]}
				]},
				{"action": "users:read", "scopes": ["users:*", "org.users:*"]},
				{"action": "teams:read", "scopes": ["teams:*"]}
			]}`),
			want: EvaluatorDTO{
				Ev: anyEvaluator{anyOf: []Evaluator{
					allEvaluator{allOf: []Evaluator{
						permissionEvaluator{Action: "users:read", Scopes: []string{"users:id:1", "org.users:id:1"}},
						permissionEvaluator{Action: "teams:read", Scopes: []string{"teams:id:2"}},
					}},
					permissionEvaluator{Action: "users:read", Scopes: []string{"users:*", "org.users:*"}},
					permissionEvaluator{Action: "teams:read", Scopes: []string{"teams:*"}},
				}},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ev := &EvaluatorDTO{}
			err := ev.UnmarshalJSON(tt.data)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			require.EqualValues(t, tt.want, *ev)
		})
	}
}
