package pattern

import "testing"

func TestValid(t *testing.T) {
	type args struct {
		pattern string
	}
	tests := []struct {
		name string
		args args
		want bool
	}{
		{
			name: "valid",
			args: args{
				pattern: "xxx",
			},
			want: true,
		},
		{
			name: "invalid",
			args: args{
				pattern: "/xxx",
			},
			want: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, _ := Valid(tt.args.pattern)
			if got != tt.want {
				t.Errorf("Valid() got = %v, want %v", got, tt.want)
			}
		})
	}
}
