package errutil

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
)

type testKey string

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

func TestWithDynamicPublicMessage(t *testing.T) {
	tests := []struct {
		name           string
		ctx            context.Context
		dynamicFn      func(context.Context) string
		expectedPublic string
	}{
		{
			name: "dynamic message based on context value",
			ctx:  context.WithValue(context.Background(), testKey("test"), "value"),
			dynamicFn: func(ctx context.Context) string {
				if ctx.Value(testKey("test")) == "value" {
					return "dynamic message 1"
				}
				return "dynamic message 2"
			},
			expectedPublic: "dynamic message 1",
		},
		{
			name: "dynamic message with different context",
			ctx:  context.WithValue(context.Background(), testKey("test"), "other"),
			dynamicFn: func(ctx context.Context) string {
				if ctx.Value(testKey("test")) == "value" {
					return "dynamic message 1"
				}
				return "dynamic message 2"
			},
			expectedPublic: "dynamic message 2",
		},
		{
			name:           "no dynamic function",
			ctx:            context.Background(),
			dynamicFn:      nil,
			expectedPublic: "default message",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			base := NewBase(StatusInternal, "test.error",
				WithPublicMessage("default message"),
			)

			if tt.dynamicFn != nil {
				base = WithDynamicPublicMessage(tt.dynamicFn)(base)
			}

			err := base.ErrorfWithContext(tt.ctx, "test error")
			assert.Error(t, err)

			// Check if it's a Grafana error
			var grafanaErr Error
			assert.ErrorAs(t, err, &grafanaErr)

			// Check the public message
			publicErr := grafanaErr.Public()
			assert.Equal(t, tt.expectedPublic, publicErr.Message)
		})
	}
}

func TestErrorfWithContext(t *testing.T) {
	tests := []struct {
		name           string
		ctx            context.Context
		format         string
		args           []interface{}
		dynamicFn      func(context.Context) string
		expectedPublic string
		expectedLog    string
	}{
		{
			name:   "dynamic message with formatted error",
			ctx:    context.WithValue(context.Background(), testKey("test"), "value"),
			format: "error: %s",
			args:   []any{"test error"},
			dynamicFn: func(ctx context.Context) string {
				if ctx.Value(testKey("test")) == "value" {
					return "dynamic message 1"
				}
				return "dynamic message 2"
			},
			expectedPublic: "dynamic message 1",
			expectedLog:    "error: test error",
		},
		{
			name:           "no dynamic function with formatted error",
			ctx:            context.Background(),
			format:         "error: %s",
			args:           []interface{}{"test error"},
			dynamicFn:      nil,
			expectedPublic: "default message",
			expectedLog:    "error: test error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			base := NewBase(StatusInternal, "test.error",
				WithPublicMessage("default message"),
			)

			if tt.dynamicFn != nil {
				base = WithDynamicPublicMessage(tt.dynamicFn)(base)
			}

			err := base.ErrorfWithContext(tt.ctx, tt.format, tt.args...)
			assert.Error(t, err)

			// Check if it's a Grafana error
			var grafanaErr Error
			assert.ErrorAs(t, err, &grafanaErr)

			// Check the public message
			publicErr := grafanaErr.Public()
			assert.Equal(t, tt.expectedPublic, publicErr.Message)

			// Check the log message
			assert.Equal(t, tt.expectedLog, grafanaErr.LogMessage)
		})
	}
}
