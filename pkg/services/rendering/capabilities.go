package rendering

import (
	"errors"

	"github.com/Masterminds/semver"
)

type Capability string

const (
	ScalingDownImages Capability = "ScalingDownImages"
	FullHeightImages  Capability = "FullHeightImages"

	// TestCapability only for unit tests
	TestCapability              Capability = "TestCapability"
	TestCapabilityInvalidSemver Capability = "TestCapabilityInvalidSemver"
)

var ErrUnknownCapability = errors.New("unknown capability")
var ErrInvalidPluginVersion = errors.New("invalid plugin version")

func getSemverConstraint(capability Capability) (string, error) {
	switch capability {
	case ScalingDownImages:
		return "", ErrUnknownCapability // TODO: change after releasing https://github.com/grafana/grafana-image-renderer/pull/312
	case FullHeightImages:
		return "", ErrUnknownCapability // TODO: change after releasing https://github.com/grafana/grafana-image-renderer/pull/312
	case TestCapability:
		return "> 1.0.0", nil
	case TestCapabilityInvalidSemver:
		return "asdf", nil
	}

	return "", ErrUnknownCapability
}

func (rs *RenderingService) HasCapability(capability Capability) (CapabilitySupportRequestResult, error) {
	semverConstraint, err := getSemverConstraint(capability)
	if err != nil {
		return CapabilitySupportRequestResult{}, err
	}

	if !rs.IsAvailable() {
		return CapabilitySupportRequestResult{IsSupported: false, SemverConstraint: semverConstraint}, ErrRenderUnavailable
	}

	compiledSemverConstraint, err := semver.NewConstraint(semverConstraint)
	if err != nil {
		rs.log.Error("Failed to parse semver constraint", "constraint", semverConstraint, "capability", capability, "error", err.Error())
		return CapabilitySupportRequestResult{IsSupported: false, SemverConstraint: semverConstraint}, ErrUnknownCapability
	}

	imageRendererVersion := rs.Version()
	imageRendererSemver, err := semver.NewVersion(imageRendererVersion)
	if err != nil {
		rs.log.Error("Failed to parse plugin version", "version", imageRendererVersion, "error", err.Error())
		return CapabilitySupportRequestResult{IsSupported: false, SemverConstraint: semverConstraint}, ErrInvalidPluginVersion
	}

	return CapabilitySupportRequestResult{IsSupported: compiledSemverConstraint.Check(imageRendererSemver), SemverConstraint: semverConstraint}, nil
}
