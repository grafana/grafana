package zip

import "dagger.io/dagger"

func Builder(d *dagger.Client) *dagger.Container {
	return d.Container().From("alpine").
		WithExec([]string{"apk", "add", "--update", "zip", "tar"})
}

func Build(c *dagger.Container, targz *dagger.File) *dagger.File {
	return c.WithFile("/src/grafana.tar.gz", targz).
		WithExec([]string{"/bin/sh", "-c", "tar xzf /src/grafana.tar.gz"}).
		WithExec([]string{"/bin/sh", "-c", "zip /src/grafana.zip $(tar tf /src/grafana.tar.gz)"}).
		File("/src/grafana.zip")
}
