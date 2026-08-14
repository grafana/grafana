package rendering

import (
	"context"
	"errors"
	"fmt"

	"github.com/Masterminds/semver"
)

type Capability struct {
	name             CapabilityName
	semverConstraint string
}

type CapabilityName string

const (
	ScalingDownImages CapabilityName = "ScalingDownImages"
	FullHeightImages  CapabilityName = "FullHeightImages"
	PDFRendering      CapabilityName = "PdfRendering"
)

var ErrUnknownCapability = errors.New("unknown capability")
var ErrInvalidPluginVersion = errors.New("invalid plugin version")

func (rs *RenderingService) HasCapability(ctx context.Context, capability CapabilityName) (CapabilitySupportRequestResult, error) {
	if !rs.IsAvailable(ctx) {
		return CapabilitySupportRequestResult{IsSupported: false, SemverConstraint: ""}, ErrRenderUnavailable
	}

	var semverConstraint string
	for i := range rs.capabilities {
		if rs.capabilities[i].name == capability {
			semverConstraint = rs.capabilities[i].semverConstraint
			break
		}
	}

	if semverConstraint == "" {
		return CapabilitySupportRequestResult{}, ErrUnknownCapability
	}

	compiledSemverConstraint, err := semver.NewConstraint(semverConstraint)
	if err != nil {
		rs.log.Error("Failed to parse semver constraint", "constraint", semverConstraint, "capability", capability, "error", err.Error())
		return CapabilitySupportRequestResult{IsSupported: false, SemverConstraint: semverConstraint}, ErrUnknownCapability
	}

	imageRendererVersion := rs.Version()
	compiledImageRendererVersion, err := semver.NewVersion(imageRendererVersion)
	if err != nil {
		rs.log.Error("Failed to parse plugin version", "version", imageRendererVersion, "error", err.Error())
		return CapabilitySupportRequestResult{IsSupported: false, SemverConstraint: semverConstraint}, ErrInvalidPluginVersion
	}

	return CapabilitySupportRequestResult{IsSupported: compiledSemverConstraint.Check(compiledImageRendererVersion), SemverConstraint: semverConstraint}, nil
}

func (rs *RenderingService) IsCapabilitySupported(ctx context.Context, capabilityName CapabilityName) error {
	capability, err := rs.HasCapability(ctx, capabilityName)
	if err != nil {
		return err
	}

	if !capability.IsSupported {
		return fmt.Errorf("%s unsupported, requires image renderer version: %s", capabilityName, capability.SemverConstraint)
	}

	return nil
}
