package legacy

import (
	"testing"
)

func TestReadContinueToken(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		wantToken continueToken
		wantErr   bool
	}{
		{
			name:  "empty token",
			input: "",
			wantToken: continueToken{
				orgId:  0,
				id:     0,
				folder: "",
			},
			wantErr: false,
		},
		{
			name:    "too few parts",
			input:   "org:1/start:2",
			wantErr: true,
		},
		{
			name:    "invalid org slug",
			input:   "foo:1/start:2/folder:abc",
			wantErr: true,
		},
		{
			name:    "invalid org id",
			input:   "org:abc/start:2/folder:abc",
			wantErr: true,
		},
		{
			name:    "invalid start slug",
			input:   "org:1/foo:2/folder:abc",
			wantErr: true,
		},
		{
			name:    "invalid start id",
			input:   "org:1/start:abc/folder:abc",
			wantErr: true,
		},
		{
			name:    "invalid folder slug",
			input:   "org:1/start:2/foo:abc",
			wantErr: true,
		},
		{
			name:  "valid token",
			input: "org:42/start:100/folder:my-folder",
			wantToken: continueToken{
				orgId:  42,
				id:     100,
				folder: "my-folder",
			},
			wantErr: false,
		},
		{
			name:  "valid token with empty folder",
			input: "org:42/start:100/folder:",
			wantToken: continueToken{
				orgId:  42,
				id:     100,
				folder: "",
			},
			wantErr: false,
		},
		{
			name:  "folder without value",
			input: "org:42/start:100/folder", // missing trailing ":"
			wantToken: continueToken{
				orgId:  42,
				id:     100,
				folder: "",
			},
			wantErr: false,
		},
		{
			name:  "missing folder",
			input: "org:42/start:100",
			wantToken: continueToken{
				orgId:  42,
				id:     100,
				folder: "",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := readContinueToken(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("readContinueToken() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if token.orgId != tt.wantToken.orgId || token.id != tt.wantToken.id || token.folder != tt.wantToken.folder {
					t.Errorf("readContinueToken() got = %+v, want %+v", token, tt.wantToken)
				}
			}
		})
	}
}

func TestContinueToken_String(t *testing.T) {
	token := continueToken{orgId: 5, id: 10, folder: "abc"}
	want := "org:5/start:10/folder:abc"
	if got := token.String(); got != want {
		t.Errorf("continueToken.String() = %q, want %q", got, want)
	}
}
