package containers

import (
	"context"
	"fmt"
	"strings"

	"dagger.io/dagger"
)

// GetJSONValue gets the value of a JSON field from a JSON file in the 'src' directory.
func GetJSONValue(ctx context.Context, d *dagger.Client, src *dagger.Directory, file string, field string) (string, error) {
	c := d.Container().From("alpine").
		WithExec([]string{"apk", "--update", "add", "jq"}).
		WithMountedDirectory("/src", src).
		WithWorkdir("/src").
		WithExec([]string{"/bin/sh", "-c", fmt.Sprintf("cat %s | jq -r .%s", file, field)})

	if stdout, err := c.Stdout(ctx); err == nil {
		return strings.TrimSpace(stdout), nil
	}

	return c.Stderr(ctx)
}
