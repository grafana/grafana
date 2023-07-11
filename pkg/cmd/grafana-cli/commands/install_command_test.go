package commands

import (
	"fmt"
	"io"
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateInput(t *testing.T) {
	t.Run("should print message for ignored args", func(t *testing.T) {
		mockCmdLine := &utils.MockCommandLine{}
		defer mockCmdLine.AssertExpectations(t)

		cmdArgs := []string{"foo", "bar", "--bar=foo"}
		expectedMsg := fmt.Sprintf("Install only supports one local argument\nArg ignored: %s\n", cmdArgs[2])

		pluginsFolder := "/tmp"

		mockArgs := &utils.MockArgs{}
		defer mockArgs.AssertExpectations(t)

		mockArgs.On("First").Return(cmdArgs[0])
		mockArgs.On("Len").Return(len(cmdArgs))
		mockArgs.On("Slice").Return(cmdArgs)

		mockCmdLine.On("Args").Return(mockArgs).Times(3)
		mockCmdLine.On("PluginDirectory").Return(pluginsFolder).Once()

		rescueStdout := os.Stdout
		r, w, _ := os.Pipe()
		os.Stdout = w

		err := validateInput(mockCmdLine, pluginsFolder)
		require.NoError(t, err)

		err = w.Close()
		if err != nil {
			t.Fatal(err)
		}
		out, _ := io.ReadAll(r)
		os.Stdout = rescueStdout

		assert.Equal(t, expectedMsg, string(out))

	})
}
