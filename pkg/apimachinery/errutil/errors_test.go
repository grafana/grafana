package errutil

import (
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBase_Is(t *testing.T) {
	baseNotFound := NotFound("test.notFound")
	baseInternal := Internal("test.internal")

	tests := []struct {
		Base            Base
		Other           error
		Expect          bool
		ExpectUnwrapped bool
	}{
		{
			Base:   Base{},
			Other:  errors.New(""),
			Expect: false,
		},
		{
			Base:   Base{},
			Other:  Base{},
			Expect: true,
		},
		{
			Base:   Base{},
			Other:  Error{},
			Expect: true,
		},
		{
			Base:   baseNotFound,
			Other:  baseNotFound,
			Expect: true,
		},
		{
			Base:   baseNotFound,
			Other:  baseNotFound.Errorf("this is an error derived from baseNotFound, it is considered to be equal to baseNotFound"),
			Expect: true,
		},
		{
			Base:   baseNotFound,
			Other:  baseInternal,
			Expect: false,
		},
		{
			Base:            baseInternal,
			Other:           fmt.Errorf("wrapped, like a burrito: %w", baseInternal.Errorf("oh noes")),
			Expect:          false,
			ExpectUnwrapped: true,
		},
	}

	for _, tc := range tests {
		t.Run(fmt.Sprintf(
			"Base '%s' == '%s' of type %s = %v (%v unwrapped)",
			tc.Base.Error(),
			tc.Other.Error(),
			reflect.TypeOf(tc.Other),
			tc.Expect,
			tc.Expect || tc.ExpectUnwrapped,
		), func(t *testing.T) {
			assert.Equal(t, tc.Expect, tc.Base.Is(tc.Other), "direct comparison")
			assert.Equal(t, tc.Expect, errors.Is(tc.Base, tc.Other), "comparison using errors.Is with other as target")
			assert.Equal(t, tc.Expect || tc.ExpectUnwrapped, errors.Is(tc.Other, tc.Base), "comparison using errors.Is with base as target, should unwrap other")
		})
	}
}

func TestError_WithContactSupportMessage(t *testing.T) {
	tests := []struct {
		name           string
		error          Error
		expectedSuffix string
	}{
		{
			name: "should append contact support message when WithContactSupportMessage is called",
			error: Error{
				Reason:        StatusInternal,
				MessageID:     "test.error",
				LogMessage:    "test error message",
				PublicMessage: "Something went wrong",
			}.WithContactSupportMessage(),
			expectedSuffix: "Please contact support if the issue persists.",
		},
		{
			name: "should not append contact support message when WithContactSupportMessage is not called",
			error: Error{
				Reason:        StatusInternal,
				MessageID:     "test.error",
				LogMessage:    "test error message",
				PublicMessage: "Something went wrong",
			},
			expectedSuffix: "",
		},
		{
			name: "should handle message with existing period",
			error: Error{
				Reason:        StatusInternal,
				MessageID:     "test.error",
				LogMessage:    "test error message",
				PublicMessage: "Something went wrong.",
			}.WithContactSupportMessage(),
			expectedSuffix: "Please contact support if the issue persists.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			public := tt.error.Public()
			message := public.Message
			if tt.expectedSuffix != "" {
				assert.True(t, strings.HasSuffix(message, tt.expectedSuffix))
			} else {
				assert.NotContains(t, message, "Please contact support if the issue persists.")
			}
		})
	}
}
