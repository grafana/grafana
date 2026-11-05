package provisioning

import (
	"net/http/httptest"
	"strings"
	"testing"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func TestReadBody(t *testing.T) {
	tests := []struct {
		name        string
		body        string
		maxSize     int64
		wantErr     bool
		errContains string
	}{
		{
			name:    "valid small body",
			body:    "hello",
			maxSize: 10,
		},
		{
			name:        "body too large",
			body:        "this is a very long body that exceeds the limit",
			maxSize:     10,
			wantErr:     true,
			errContains: errMsgRequestTooLarge,
		},
		{
			name:    "body exactly at limit",
			body:    "1234567890",
			maxSize: 10,
		},
		{
			name:    "zero maxSize disables the cap",
			body:    "anything goes when the cap is unlimited",
			maxSize: 0,
		},
		{
			name:    "negative maxSize disables the cap",
			body:    "anything goes when the cap is unlimited",
			maxSize: -1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest("POST", "/", strings.NewReader(tt.body))
			got, err := readBody(r, tt.maxSize)

			if tt.wantErr {
				if err == nil {
					t.Error("readBody() expected error but got none")
				}
				if !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("readBody() error = %v, want containing %v", err, tt.errContains)
				}
				return
			}
			if err != nil {
				t.Errorf("readBody() unexpected error = %v", err)
				return
			}
			if string(got) != tt.body {
				t.Errorf("readBody() = %v, want %v", string(got), tt.body)
			}
		})
	}
}

func TestIsJSONContentType(t *testing.T) {
	tests := []struct {
		name        string
		contentType string
		want        bool
	}{
		{
			name:        "valid JSON content type",
			contentType: "application/json",
			want:        true,
		},
		{
			name:        "JSON with charset",
			contentType: "application/json; charset=utf-8",
			want:        true,
		},
		{
			name:        "not JSON",
			contentType: "text/plain",
			want:        false,
		},
		{
			name:        "empty content type",
			contentType: "",
			want:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest("POST", "/", nil)
			r.Header.Set("Content-Type", tt.contentType)
			if got := isJSONContentType(r); got != tt.want {
				t.Errorf("isJSONContentType() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUnmarshalJSON(t *testing.T) {
	type testStruct struct {
		Name string `json:"name"`
		Age  int    `json:"age"`
	}

	tests := []struct {
		name        string
		body        string
		maxSize     int64
		contentType string
		wantErr     bool
		errContains string
	}{
		{
			name:        "valid JSON",
			body:        `{"name":"test","age":30}`,
			maxSize:     1024,
			contentType: contentTypeJSON,
		},
		{
			name:        "invalid content type",
			body:        `{"name":"test"}`,
			maxSize:     1024,
			contentType: "text/plain",
			wantErr:     true,
			errContains: "content type is not JSON",
		},
		{
			name:        "body too large",
			body:        `{"name":"test","age":30}`,
			maxSize:     10,
			contentType: contentTypeJSON,
			wantErr:     true,
			errContains: errMsgRequestTooLarge,
		},
		{
			name:        "multiple JSON objects",
			body:        `{"name":"test"} {"name":"test2"}`,
			maxSize:     1024,
			contentType: contentTypeJSON,
			wantErr:     true,
			errContains: "multiple JSON objects not allowed",
		},
		{
			name:        "empty body",
			body:        "",
			maxSize:     1024,
			contentType: contentTypeJSON,
			wantErr:     true,
			errContains: "empty request body",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest("POST", "/", strings.NewReader(tt.body))
			r.Header.Set("Content-Type", tt.contentType)

			var result testStruct
			err := unmarshalJSON(r, tt.maxSize, &result)

			if tt.wantErr {
				if err == nil {
					t.Error("unmarshalJSON() expected error but got none")
				}
				if !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("unmarshalJSON() error = %v, want containing %v", err, tt.errContains)
				}
				return
			}
			if err != nil {
				t.Errorf("unmarshalJSON() unexpected error = %v", err)
			}
		})
	}
}

func TestNewDecodeError(t *testing.T) {
	post := func(body string, maxSize int64) error {
		r := httptest.NewRequest("POST", "/", strings.NewReader(body))
		r.Header.Set("Content-Type", contentTypeJSON)
		var result struct {
			Name string `json:"name"`
		}
		return unmarshalJSON(r, maxSize, &result)
	}

	t.Run("body over the limit is a 413", func(t *testing.T) {
		err := newDecodeError("Thing", post(`{"name":"too long for the cap"}`, 5))
		if !apierrors.IsRequestEntityTooLargeError(err) {
			t.Errorf("newDecodeError() = %v, want a request entity too large error", err)
		}
		if !strings.Contains(err.Error(), errMsgRequestTooLarge) {
			t.Errorf("newDecodeError() = %v, want containing %q", err, errMsgRequestTooLarge)
		}
	})

	t.Run("malformed body is a 400 that names the cause", func(t *testing.T) {
		err := newDecodeError("Thing", post(`{"unknown":1}`, 1024))
		if !apierrors.IsBadRequest(err) {
			t.Errorf("newDecodeError() = %v, want a bad request error", err)
		}
		if !strings.Contains(err.Error(), "error decoding Thing from request") || !strings.Contains(err.Error(), "unknown field") {
			t.Errorf("newDecodeError() = %v, want the kind and the decode cause", err)
		}
	})
}
