package env

import (
	"fmt"
	"os"
	"strings"

	"github.com/urfave/cli/v2"
)

// RequireListWithEnvFallback first checks the CLI for a flag with the required
// name. If this is empty, it  falls back to taking the environment variable.
// Sadly, we cannot use cli.Flag.EnvVars for this due to it potentially leaking
// environment variables as default values in usage-errors.
func RequireListWithEnvFallback(cctx *cli.Context, name string, envName string) ([]string, error) {
	result := cctx.StringSlice(name)
	if len(result) == 0 {
		for _, v := range strings.Split(os.Getenv(envName), ",") {
			value := strings.TrimSpace(v)
			if value != "" {
				result = append(result, value)
			}
		}
	}
	if len(result) == 0 {
		return nil, cli.Exit(fmt.Sprintf("Required flag (%s) or environment variable (%s) not set", name, envName), 1)
	}
	return result, nil
}

func RequireStringWithEnvFallback(cctx *cli.Context, name string, envName string) (string, error) {
	result := cctx.String(name)
	if result == "" {
		result = os.Getenv(envName)
	}
	if result == "" {
		return "", cli.Exit(fmt.Sprintf("Required flag (%s) or environment variable (%s) not set", name, envName), 1)
	}
	return result, nil
}
