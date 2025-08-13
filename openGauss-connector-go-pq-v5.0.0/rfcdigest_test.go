// Copyright © 2021 Bin Liu <bin.liu@enmotech.com>

package pq

import (
	"reflect"
	"testing"
)

func TestRFC5802Algorithm(t *testing.T) {
	type args struct {
		password        string
		random64code    string
		token           string
		serverSignature string
		serverIteration int
		method          string
	}
	tests := []struct {
		name string
		args args
		want []byte
	}{
		{
			name: "sm3",
			args: args{
				password:        "sm3@abc123",
				random64code:    "5ae737626add65f8da1b063104a6c4e2dc25b7343d8512a74826dc5b5e3e5188",
				token:           string([]byte{0, 0, 0, 0, 0, 0, 0, 0}),
				serverSignature: "",
				serverIteration: 10000,
				method:          "sm3",
			},
			want: []byte{48, 48, 57, 102, 56, 52, 52, 99, 49, 57, 56, 48, 102, 53, 48, 49, 99, 54, 54, 99, 54, 56, 52, 49, 50, 98, 48, 97, 98, 99, 98, 53, 97, 101, 49, 55, 54, 100, 101, 51, 50, 102, 102, 98, 98, 98, 97, 101, 57, 55, 48, 98, 56, 50, 57, 50, 50, 49, 99, 100, 48, 99, 48, 56},
		},
		{
			name: "sha256",
			args: args{
				password:        "sha256@abc123",
				random64code:    "3458fe51abe962f7b6011a1d73fc14edf50539fae89fb9dda75fbb642d9859bf",
				token:           string([]byte{50, 99, 102, 55, 49, 102, 49, 48}),
				serverSignature: "",
				serverIteration: 10000,
				method:          "sha256",
			},
			want: []byte{102, 53, 50, 49, 51, 97, 102, 57, 51, 57, 55, 52, 97, 101, 51, 102, 48, 97, 51, 101, 101, 100, 98, 97, 55, 98, 48, 101, 102, 50, 55, 55, 57, 54, 98, 99, 100, 52, 100, 56, 52, 98, 98, 55, 51, 55, 100, 57, 99, 51, 53, 102, 99, 101, 53, 52, 102, 99, 102, 101, 50, 56, 102, 100},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := RFC5802Algorithm(tt.args.password, tt.args.random64code, tt.args.token, tt.args.serverSignature, tt.args.serverIteration, tt.args.method); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("RFC5802Algorithm() = %v, want %v", got, tt.want)
			}
		})
	}
}
