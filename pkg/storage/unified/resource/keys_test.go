package resource

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

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

	namespaceTooLong := strings.Repeat("a", 61)
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

	namespaceTooLong := strings.Repeat("a", 61)

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
