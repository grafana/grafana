package containers

// func BackendTestShort(d *dagger.Client, platform dagger.Platform, dir *dagger.Directory) *dagger.Container {
// 	return GrafanaContainer(d, platform, GetGoImageAlpine("1.21.0"), dir).
// 		WithExec([]string{"go", "test", "-tags", "requires_buildifer", "-short", "-covermode", "atomic", "-timeout", "5m", "./pkg/..."})
// }
//
// func BackendTestIntegration(d *dagger.Client, platform dagger.Platform, dir *dagger.Directory) *dagger.Container {
// 	return GrafanaContainer(d, platform, GetGoImageAlpine("1.21.0"), dir).
// 		WithExec([]string{"go", "test", "-run", "Integration", "-covermode", "atomic", "-timeout", "5m", "./pkg/..."})
// }
