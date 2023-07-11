package commands

import (
	"testing"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/stretchr/testify/require"
)

func TestValidateInput(t *testing.T) {
	t.Run("should print message for ignored args", func(t *testing.T) {
		mockCmdLine := &utils.MockCommandLine{}
		defer mockCmdLine.AssertExpectations(t)

		cmdArgs := []string{"foo", "bar", "--bar=foo"}

		mockArgs := &utils.MockArgs{}
		defer mockArgs.AssertExpectations(t)

		mockArgs.On("Len").Return(len(cmdArgs))
		mockCmdLine.On("Args").Return(mockArgs).Times(1)

		err := validateInput(mockCmdLine)
		require.EqualError(t, err, "install only supports 2 arguments: plugin and version")
	})
}
