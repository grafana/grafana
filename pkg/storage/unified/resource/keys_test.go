package resource

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/validation"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestKeyMatching(t *testing.T) {
	t.Run("key matching", func(t *testing.T) {
		require.True(t, matchesQueryKey(&resourcepb.ResourceKey{
			Group:     "ggg",
			Resource:  "rrr",
			Namespace: "ns",
		}, &resourcepb.ResourceKey{
			Group:     "ggg",
			Resource:  "rrr",
			Namespace: "ns",
		}))
	})
}

func TestSearchIDKeys(t *testing.T) {
	tests := []struct {
		input    string
		expected *resourcepb.ResourceKey // nil error
	}{
		{input: "a"}, // error
		{input: "default/group/resource/name",
			expected: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "group",
				Resource:  "resource",
				Name:      "name",
			}},
		{input: "/group/resource/",
			expected: &resourcepb.ResourceKey{
				Namespace: "",
				Group:     "group",
				Resource:  "resource",
				Name:      "",
			}},
		{input: "default/group/resource",
			expected: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "group",
				Resource:  "resource",
				Name:      "",
			}},
		{input: "**cluster**/group/resource/aaa", // cluster namespace
			expected: &resourcepb.ResourceKey{
				Namespace: "",
				Group:     "group",
				Resource:  "resource",
				Name:      "aaa",
			}},
	}

	for _, test := range tests {
		tmp := &resourcepb.ResourceKey{}
		err := ReadSearchID(tmp, test.input)
		if err == nil {
			require.Equal(t, test.expected, tmp, test.input)
		}
	}
}

func TestVerifyRequestKey(t *testing.T) {
	validGroup := "group.grafana.app"
	validResource := "resource"
	validNamespace := "default"
	validName := "fdgsv37qslr0ga"
	validLegacyUID := "f8cc010c-ee72-4681-89d2-d46e1bd47d33"

	invalidGroup := "group.~~~~~grafana.app"
	invalidResource := "##resource"
	invalidNamespace := "(((((default"
	invalidName := "    " // only spaces

	namespaceTooLong := strings.Repeat("a", 41)
	nameTooLong := strings.Repeat("a", 300)

	tests := []struct {
		name         string
		input        *resourcepb.ResourceKey
		expectedCode int32
	}{
		{
			name: "no error when all fields are set and valid",
			input: &resourcepb.ResourceKey{
				Namespace: validNamespace,
				Group:     validGroup,
				Resource:  validResource,
				Name:      validName,
			},
		},
		{
			name: "invalid namespace returns error",
			input: &resourcepb.ResourceKey{
				Namespace: invalidNamespace,
				Group:     validGroup,
				Resource:  validResource,
				Name:      validName,
			},
			expectedCode: http.StatusBadRequest,
		},
		{
			name: "invalid group returns error",
			input: &resourcepb.ResourceKey{
				Namespace: validNamespace,
				Group:     invalidGroup,
				Resource:  validResource,
				Name:      validName,
			},
			expectedCode: http.StatusBadRequest,
		},
		{
			name: "invalid resource returns error",
			input: &resourcepb.ResourceKey{
				Namespace: validNamespace,
				Group:     validGroup,
				Resource:  invalidResource,
				Name:      validName,
			},
			expectedCode: http.StatusBadRequest,
		},
		{
			name: "invalid name returns error",
			input: &resourcepb.ResourceKey{
				Namespace: validNamespace,
				Group:     validGroup,
				Resource:  validResource,
				Name:      invalidName,
			},
			expectedCode: http.StatusBadRequest,
		},
		{
			name: "valid legacy UID returns no error",
			input: &resourcepb.ResourceKey{
				Namespace: validNamespace,
				Group:     validGroup,
				Resource:  validResource,
				Name:      validLegacyUID,
			},
		},
		{
			name: "namespace too long returns error",
			input: &resourcepb.ResourceKey{
				Namespace: namespaceTooLong,
				Group:     validGroup,
				Resource:  validResource,
				Name:      validName,
			},
			expectedCode: http.StatusBadRequest,
		},
		{
			name: "name too long returns error",
			input: &resourcepb.ResourceKey{
				Namespace: namespaceTooLong,
				Group:     validGroup,
				Resource:  validResource,
				Name:      nameTooLong,
			},
			expectedCode: http.StatusBadRequest,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := verifyRequestKey(test.input)
			if test.expectedCode == 0 {
				require.Nil(t, err)
				return
			}

			require.Equal(t, test.expectedCode, err.Code)
		})
	}
}

func TestVerifyRequestKeyCollection(t *testing.T) {
	validGroup := "group.grafana.app"
	validResource := "resource"
	validNamespace := "default"
	invalidName := "    " // only spaces

	invalidGroup := "group.~~~~~grafana.app"
	invalidResource := "##resource"
	invalidNamespace := "(((((default"

	namespaceTooLong := strings.Repeat("a", 41)

	tests := []struct {
		name         string
		input        *resourcepb.ResourceKey
		expectedCode int32
	}{
		{
			name: "no error when all fields are set and valid",
			input: &resourcepb.ResourceKey{
				Namespace: validNamespace,
				Group:     validGroup,
				Resource:  validResource,
			},
		},
		{
			name: "invalid namespace returns error",
			input: &resourcepb.ResourceKey{
				Namespace: invalidNamespace,
				Group:     validGroup,
				Resource:  validResource,
			},
			expectedCode: http.StatusBadRequest,
		},
		{
			name: "invalid group returns error",
			input: &resourcepb.ResourceKey{
				Namespace: validNamespace,
				Group:     invalidGroup,
				Resource:  validResource,
			},
			expectedCode: http.StatusBadRequest,
		},
		{
			name: "invalid resource returns error",
			input: &resourcepb.ResourceKey{
				Namespace: validNamespace,
				Group:     validGroup,
				Resource:  invalidResource,
			},
			expectedCode: http.StatusBadRequest,
		},
		{
			name: "invalid name returns no error",
			input: &resourcepb.ResourceKey{
				Namespace: validNamespace,
				Group:     validGroup,
				Resource:  validResource,
				Name:      invalidName,
			},
		},
		{
			name: "namespace too long returns error",
			input: &resourcepb.ResourceKey{
				Namespace: namespaceTooLong,
				Group:     validGroup,
				Resource:  validResource,
			},
			expectedCode: http.StatusBadRequest,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := verifyRequestKeyCollection(test.input)
			if test.expectedCode == 0 {
				require.Nil(t, err)
				return
			}

			require.Equal(t, test.expectedCode, err.Code)
		})
	}
}

// TestKeyRegexCoversValidationCharSets pins the contract that the unified
// storage KV regex (kv.IsValidKey) accepts every byte the upstream Grafana
// resource-name validators (IsValidGrafanaName / IsValidNamespace /
// IsValidGroup / IsValidResource) accept.
//
// Why: ensure KV regex supports Grafana API regex expressions
//
// The test lives in pkg/storage/unified/resource to avoid dependency between
// validation and kv packages.
func TestKeyRegexCoversValidationCharSets(t *testing.T) {
	validators := map[string]func(string) []string{
		"IsValidGrafanaName": validation.IsValidGrafanaName,
		"IsValidNamespace":   validation.IsValidNamespace,
		"IsValidGroup":       validation.IsValidGroup,
		"IsValidResource":    validation.IsValidResource,
	}

	// so upstream regex don't reject the probe byte for the wrong reason.
	// Only sweep ASCII (0..127) because upstream regex's characters are ASCII.
	for b := 0; b < 128; b++ {
		// Probe ASCII bytes between a alphanumeric string to pass name validation
		sample := "ab" + string(rune(b)) + "cd"

		for name, accepts := range validators {
			if errs := accepts(sample); len(errs) > 0 {
				continue
			}
			require.Truef(t, kv.IsValidKey(sample),
				"%s accepts rune %q in sample %q, but kv.IsValidKey rejects it",
				name, rune(b), sample)
		}
	}
}
