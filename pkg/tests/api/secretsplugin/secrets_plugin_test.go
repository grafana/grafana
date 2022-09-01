package secretsplugin

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var installPluginOnce sync.Once

const awsPluginName string = "grafana-aws-secretsmanager"
const pluginDir string = "/tmp/awsplugin"

func TestIntegrationSecretsPluginEnabled(t *testing.T) {
	grafanaDir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{})

	setupSecretsPluginTest(t, grafanaDir)

	grafanaListeningAddr, testEnv := testinfra.StartGrafanaEnv(t, grafanaDir, cfgPath)
	assert.NotEmpty(t, grafanaListeningAddr)
	assert.NotNil(t, testEnv)
}

func setupSecretsPluginTest(t *testing.T, grafanaDir string) {
	t.Helper()
	defer func() {
		os.RemoveAll(pluginDir)
	}()
	installPluginOnce.Do(func() {
		os.RemoveAll(pluginDir)
		buildSecretsPlugin(t, grafanaDir)
	})

}

func buildSecretsPlugin(t *testing.T, grafanaDir string) {
	t.Helper()

	// const pluginDir string = filepath.Join(grafanaDir, "tmp")
	// Clone the plugin repository
	fmt.Println("git clone https://github.com/grafana/grafana-aws-secrets-manager.git")
	_, err := git.PlainClone(pluginDir, false, &git.CloneOptions{
		URL: "https://github.com/grafana/grafana-aws-secrets-manager.git",
		Auth: &http.BasicAuth{
			Username: os.Getenv("SECRETS_PLUGIN_TEST_USER"),
			Password: os.Getenv("SECRETS_PLUGIN_TEST_TOKEN"),
		},
		Progress: os.Stdout,
	})
	require.NoError(t, err)

	// Install yarn dependencies in the plugin repo
	fmt.Println("yarn install")
	cmd := exec.Command("yarn", "install")
	cmd.Dir = pluginDir
	require.NoError(t, cmd.Run())

	// Build the plugin
	fmt.Println("mage build")
	cmd = exec.Command("mage", "build")
	cmd.Dir = pluginDir
	require.NoError(t, cmd.Run())

	// Move the plugin build to the grafana plugins dir
	os.MkdirAll(filepath.Join(grafanaDir, "plugins"), 0750)
	cmd = exec.Command("mv", filepath.Join(pluginDir, "dist"), filepath.Join(grafanaDir, "plugins", awsPluginName))
	fmt.Print(cmd.String())
	require.NoError(t, cmd.Run())
}

// how to check out a branch
// if err != nil {
// 	return err
// }

// ref, err := repo.Head()
// if err != nil {
// 	return err
// }

// w, err := repo.Worktree()
// if err != nil {
// 	return err
// }

// err = w.Checkout(&git.CheckoutOptions{
// 	Hash: ref.Hash(),
// })
// if err != nil {
// 	return err
// }
