package commands

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestValidateInput(t *testing.T) {
	t.Skip("Error removed due to development plugins")
	t.Run("should return an error for wrong args number", func(t *testing.T) {
		mockCmdLine := &utils.MockCommandLine{}
		defer mockCmdLine.AssertExpectations(t)

		cmdArgs := []string{"foo", "bar", "--bar=foo"}

		mockArgs := &utils.MockArgs{}
		defer mockArgs.AssertExpectations(t)

		mockArgs.On("Len").Return(len(cmdArgs))
		mockCmdLine.On("Args").Return(mockArgs).Once()

		err := validateInput(mockCmdLine)
		require.EqualError(t, err, "install only supports 2 arguments: plugin and version")
	})

	tests := []struct {
		desc          string
		versionArg    string
		shouldSucceed bool
	}{
		{
			desc:          "should successful validate semver arg",
			versionArg:    "1.2.3",
			shouldSucceed: true,
		},
		{
			desc:          "should successful validate complex semver arg",
			versionArg:    "1.0.0-alpha.0valid",
			shouldSucceed: true,
		},
		{
			desc:       "should fail non version arg",
			versionArg: "bar",
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			mockCmdLine := &utils.MockCommandLine{}
			defer mockCmdLine.AssertExpectations(t)

			cmdArgs := []string{"foo", tt.versionArg}

			mockArgs := &utils.MockArgs{}
			defer mockArgs.AssertExpectations(t)

			mockArgs.On("Len").Return(len(cmdArgs))
			mockArgs.On("First").Return(cmdArgs[0])
			mockArgs.On("Get", mock.AnythingOfType("int")).Return(cmdArgs[1])

			mockCmdLine.On("Args").Return(mockArgs).Once()

			if tt.shouldSucceed {
				mockCmdLine.On("PluginDirectory").Return("/tmp").Once()
			}

			err := validateInput(mockCmdLine)

			if tt.shouldSucceed {
				require.NoError(t, err)
			} else {
				require.EqualError(t, err, fmt.Sprintf("the provided version (%s) is invalid", cmdArgs[1]))
			}
		})
	}
}
