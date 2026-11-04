package v1

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateTemplateUID(t *testing.T) {
	testCases := []struct {
		name    string
		uid     string
		wantErr bool
	}{
		{name: "valid", uid: "my-template.1"},
		{name: "max length", uid: strings.Repeat("a", 40)},
		{name: "empty", uid: "", wantErr: true},
		{name: "blank", uid: "  ", wantErr: true},
		{name: "colon", uid: "a:b", wantErr: true},
		{name: "too long", uid: strings.Repeat("a", 41), wantErr: true},
		{name: "uppercase", uid: "Upper", wantErr: true},
		{name: "underscore", uid: "a_b", wantErr: true},
		{name: "base64 of a template name", uid: "Z3JhZmFuYXx0ZXN0", wantErr: true},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateTemplateUID(tc.uid)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}
