package rendering

import (
	"errors"

	"github.com/Masterminds/semver"
)

type Feature string

const (
	ScalingDownImages Feature = "ScalingDownImages"
	FullHeightImages  Feature = "FullHeightImages"

	// TestFeature only for unit tests
	TestFeature              Feature = "TestFeature"
	TestFeatureInvalidSemver Feature = "TestFeatureInvalidSemver"
)

var ErrUnsupportedFeature = errors.New("unsupported feature")
var ErrInvalidPluginVersion = errors.New("invalid plugin version")

func getSemverConstraint(feature Feature) (string, error) {
	switch feature {
	case ScalingDownImages:
		return "", ErrUnsupportedFeature // TODO: change after releasing https://github.com/grafana/grafana-image-renderer/pull/312
	case FullHeightImages:
		return "", ErrUnsupportedFeature // TODO: change after releasing https://github.com/grafana/grafana-image-renderer/pull/312
	case TestFeature:
		return "> 1.0.0", nil
	case TestFeatureInvalidSemver:
		return "asdf", nil
	}

	return "", ErrUnsupportedFeature
}

func (rs *RenderingService) SupportsFeature(feature Feature) (FeatureSupportRequestResult, error) {
	semverConstraint, err := getSemverConstraint(feature)
	if err != nil {
		return FeatureSupportRequestResult{}, err
	}

	if !rs.IsAvailable() {
		return FeatureSupportRequestResult{IsSupported: false, SemverConstraint: semverConstraint}, ErrRenderUnavailable
	}

	compiledSemverConstraint, err := semver.NewConstraint(semverConstraint)
	if err != nil {
		rs.log.Error("Failed to parse semver constraint", "constraint", semverConstraint, "feature", feature, "error", err.Error())
		return FeatureSupportRequestResult{IsSupported: false, SemverConstraint: semverConstraint}, ErrUnsupportedFeature

	}

	imageRendererVersion := rs.Version()
	imageRendererSemver, err := semver.NewVersion(imageRendererVersion)
	if err != nil {
		rs.log.Error("Failed to parse plugin version", "version", imageRendererVersion, "error", err.Error())
		return FeatureSupportRequestResult{IsSupported: false, SemverConstraint: semverConstraint}, ErrInvalidPluginVersion
	}

	return FeatureSupportRequestResult{IsSupported: compiledSemverConstraint.Check(imageRendererSemver), SemverConstraint: semverConstraint}, nil
}
