# Guide to upgrading dependencies

Upgrading Go or Node.js requires making changes in many different files. Refer to the following list for more information.

## Go

- Drone
- `grafana/build-container`
- Appveyor
- Dockerfile

## Node.js

- Drone
- `grafana/build-container`
- Appveyor
- Dockerfile
- `.github/workflows/publish.yml`

## Go dependencies

The Grafana project uses [Go modules](https://golang.org/cmd/go/#hdr-Modules__module_versions__and_more) to manage dependencies on external packages. This requires a working Go environment with version 1.11 or later installed.

To add or update a new dependency, use the `go get` command:

- To update to the latest version of a package: `go get example.com/some/module/pkg`
- To update to a specific version of a package: `go get example.com/some/module/pkg@vX.Y.Z`

Unless you're backporting, tidy up the dependency files with `go mod tidy`.
If you are backporting, be careful about this; it may be fine, but you should avoid it if it would entail changing the `go` version directive (which defines the minimum Go version).
If you are touching the workspace, you may also want to run `make update-workspace`.

You have to commit the changes to `go.mod`, `go.sum`, and `go.work.sum` before you submit the pull request, otherwise CI jobs may fail.
Submodules have similar files, and may also need to be committed.

To understand what the actual dependencies of `grafana-server` are, you can run it with the `-vv` flag. Note that this command might produce an output different from `go.mod` contents, and `-vv` option is the source of truth here. The output lists the modules _compiled_ into the executable, whereas `go.mod` lists also test and weak transitive dependencies (that is, modules, used in some packages, which aren't in use by itself). If you're interested in reporting a vulnerability in a dependency module, consult the `-vv` output, maybe the "dependency" isn't actually a dependency as such.

### Upgrading dependencies

If you need to upgrade a direct or indirect dependency, you can do it like so, where _`MODULE`_ is the dependency in question: `go get -u <MODULE>`. The corresponding entry in `go.mod` should then have the version you specified. If it's an indirect dependency, the entry should have the `// indirect` comment.

To do so, execute `go mod tidy` to ensure that `go.mod` and `go.sum` are updated. If the indirect dependency turns out to not be used (transitively) by any of our packages, `go mod tidy` actually strips it from `go.mod`. In that case, you can just ignore it because ultimately it isn't used.

## Node.js dependencies

Updated using `yarn`:

- `package.json`

## Where to make changes

### Drone

Our CI builds run on Drone.

#### Files

- `.circleci/config.yml`.

#### Dependencies

- Node.js
- Go
- `grafana/build-container` (our custom Docker build container)

### grafana/build-container

The main build steps (in Drone) happen using a custom Docker image that comes pre-baked with some of the necessary dependencies.

Link: [`grafana/build-container`](https://github.com/grafana/grafana/tree/main/scripts/build/ci-build)

#### Dependencies

- fpm
- Node.js
- Go
- cross-compiling (several compilers)

### Appveyor

Main and release builds trigger test runs on the Appveyors build environment so that tests will run on Windows.

#### Files:

- `appveyor.yml`

#### Dependencies

- nodejs
- golang

### Dockerfile

There is a Docker build for Grafana in the root of the project that allows anyone to build Grafana just using Docker.

#### Files

- `Dockerfile`

#### Dependencies

- nodejs
- golang

### Local developer environments

It is a good practice to send out a notice in the grafana-dev Slack channel when updating Go or Node.js to make it easier for everyone to update their local developer environments.
