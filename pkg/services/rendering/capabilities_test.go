package rendering

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type dummyPluginManager struct{}

func (d *dummyPluginManager) Renderer(_ context.Context) *plugins.Plugin {
	return nil
}

var dummyRendererUrl = "http://dummyurl.com"
var testCapabilitySemverConstraint = "> 1.0.0"
var testCapabilityName = CapabilityName("TestCap")
var testCapabilityNameInvalidSemver = CapabilityName("TestCapInvalidSemver")

func TestCapabilities(t *testing.T) {
	cfg := setting.NewCfg()
	rs := &RenderingService{
		Cfg:                   cfg,
		RendererPluginManager: &dummyPluginManager{},
		log:                   log.New("test-capabilities-rendering-service"),
		capabilities: []Capability{
			{name: testCapabilityName, semverConstraint: testCapabilitySemverConstraint},
			{name: testCapabilityNameInvalidSemver, semverConstraint: "asfasf"},
		},
	}

	tests := []struct {
		name            string
		rendererUrl     string
		rendererVersion string
		capabilityName  CapabilityName
		expectedError   error
		expectedResult  CapabilitySupportRequestResult
	}{
		{
			name:            "when image-renderer plugin is not available",
			rendererUrl:     "",
			rendererVersion: "",
			capabilityName:  testCapabilityName,
			expectedError:   ErrRenderUnavailable,
			expectedResult: CapabilitySupportRequestResult{
				IsSupported:      false,
				SemverConstraint: "",
			},
		},
		{
			name:            "when image-renderer plugin version is not populated",
			rendererUrl:     dummyRendererUrl,
			rendererVersion: "",
			capabilityName:  testCapabilityName,
			expectedError:   ErrInvalidPluginVersion,
			expectedResult: CapabilitySupportRequestResult{
				IsSupported:      false,
				SemverConstraint: testCapabilitySemverConstraint,
			},
		},
		{
			name:            "when image-renderer plugin version is not valid",
			rendererUrl:     dummyRendererUrl,
			rendererVersion: "abcd",
			capabilityName:  testCapabilityName,
			expectedError:   ErrInvalidPluginVersion,
			expectedResult: CapabilitySupportRequestResult{
				IsSupported:      false,
				SemverConstraint: testCapabilitySemverConstraint,
			},
		},
		{
			name:            "when image-renderer version does not match target constraint",
			rendererUrl:     dummyRendererUrl,
			rendererVersion: "1.0.0",
			capabilityName:  testCapabilityName,
			expectedError:   nil,
			expectedResult: CapabilitySupportRequestResult{
				IsSupported:      false,
				SemverConstraint: testCapabilitySemverConstraint,
			},
		},
		{
			name:            "when image-renderer version matches target constraint",
			rendererUrl:     dummyRendererUrl,
			rendererVersion: "2.0.0",
			capabilityName:  testCapabilityName,
			expectedError:   nil,
			expectedResult: CapabilitySupportRequestResult{
				IsSupported:      true,
				SemverConstraint: testCapabilitySemverConstraint,
			},
		},
		{
			name:            "when capability is unknown",
			rendererUrl:     dummyRendererUrl,
			rendererVersion: "1.0.0",
			capabilityName:  CapabilityName("unknown"),
			expectedError:   ErrUnknownCapability,
			expectedResult: CapabilitySupportRequestResult{
				IsSupported:      false,
				SemverConstraint: "",
			},
		},
		{
			name:            "when capability has invalid semver constraint",
			rendererUrl:     dummyRendererUrl,
			rendererVersion: "1.0.0",
			capabilityName:  testCapabilityNameInvalidSemver,
			expectedError:   ErrUnknownCapability,
			expectedResult: CapabilitySupportRequestResult{
				IsSupported:      false,
				SemverConstraint: "asfasf",
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rs.Cfg.RendererUrl = tt.rendererUrl
			rs.version = tt.rendererVersion
			res, err := rs.HasCapability(context.Background(), tt.capabilityName)

			if tt.expectedError == nil {
				require.NoError(t, err)
			} else {
				require.ErrorIs(t, err, tt.expectedError)
			}
			require.Equal(t, tt.expectedResult, res)
		})
	}
}
