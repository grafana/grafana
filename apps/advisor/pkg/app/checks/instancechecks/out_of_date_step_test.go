package instancechecks

import (
	"testing"

	"github.com/Masterminds/semver/v3"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/assert"
)

func TestParseVersionInfo(t *testing.T) {
	t.Parallel()

	t.Run("detects an instance that is multiple major versions behind", func(t *testing.T) {
		t.Parallel()

		logger := &logging.NoOpLogger{}
		step := &outOfDateVersionStep{}

		current := *semver.MustParse("10.4.17")

		releases := []semver.Version{
			*semver.MustParse("9.5.3"),
			*semver.MustParse("10.4.16"),
			*semver.MustParse("10.4.17+security-01"),
			*semver.MustParse("10.4.19+security-01"),
			*semver.MustParse("11.5.6"),
			*semver.MustParse("11.6.6"),
			*semver.MustParse("12.0.0"),
			*semver.MustParse("12.0.1"),
		}

		versionInfo := step.parseVersionInfo(current, releases, logger)

		assert.Len(t, versionInfo.latestMajorVersions, 2)

		assert.Equal(t, "11.6.6", versionInfo.latestMajorVersions[11].String())
		assert.Equal(t, "12.0.1", versionInfo.latestMajorVersions[12].String())

		assert.Equal(t, "10.4.19+security-01", versionInfo.latestPatch.String())
		assert.Equal(t, "10.4.17+security-01", versionInfo.latestSecurityPatch.String())
	})
}

func TestParseSecurityRelease(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		metadata string
		expected int
		wantErr  bool
	}{
		{
			name:     "valid security release",
			metadata: "security-01",
			expected: 1,
			wantErr:  false,
		},
		{
			name:     "valid security release with higher number",
			metadata: "security-10",
			expected: 10,
			wantErr:  false,
		},
		{
			name:     "empty metadata",
			metadata: "",
			expected: 0,
			wantErr:  false,
		},
		{
			name:     "invalid format - no dash",
			metadata: "security01",
			expected: 0,
			wantErr:  true,
		},
		{
			name:     "invalid security tag",
			metadata: "patch-01",
			expected: 0,
			wantErr:  true,
		},
		{
			name:     "invalid release number",
			metadata: "security-abc",
			expected: 0,
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			result, err := parseSecurityRelease(tt.metadata)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}
