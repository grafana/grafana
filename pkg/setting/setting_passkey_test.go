package setting

import "testing"

func TestValidatePasskeySettings(t *testing.T) {
	tests := []struct {
		name    string
		rpID    string
		origins []string
		wantErr bool
	}{
		{
			name:    "exact host match",
			rpID:    "example.com",
			origins: []string{"https://example.com"},
		},
		{
			name:    "subdomain origin under rp_id",
			rpID:    "example.com",
			origins: []string{"https://grafana.example.com"},
		},
		{
			name:    "localhost for dev",
			rpID:    "localhost",
			origins: []string{"http://localhost:3000"},
		},
		{
			name:    "multiple valid origins",
			rpID:    "example.com",
			origins: []string{"https://example.com", "https://grafana.example.com"},
		},
		{
			name:    "empty rp_id",
			rpID:    "",
			origins: []string{"https://example.com"},
			wantErr: true,
		},
		{
			name:    "empty origins",
			rpID:    "example.com",
			origins: nil,
			wantErr: true,
		},
		{
			name:    "unrelated origin",
			rpID:    "example.com",
			origins: []string{"https://other.com"},
			wantErr: true,
		},
		{
			name:    "look-alike domain is rejected",
			rpID:    "example.com",
			origins: []string{"https://notexample.com"},
			wantErr: true,
		},
		{
			name:    "one bad origin among good ones",
			rpID:    "example.com",
			origins: []string{"https://example.com", "https://evil.com"},
			wantErr: true,
		},
		{
			name:    "origin with no host",
			rpID:    "example.com",
			origins: []string{"not-a-url"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validatePasskeySettings(PasskeySettings{
				Enabled:   true,
				RPID:      tt.rpID,
				RPOrigins: tt.origins,
			})
			if tt.wantErr && err == nil {
				t.Errorf("expected an error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("expected no error, got: %v", err)
			}
		})
	}
}
