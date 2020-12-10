# Guide to upgrading dependencies

Upgrading Go or Node.js requires making changes in many different files. See below for a list and explanation for each.

## Go

- CircleCi
- `grafana/build-container`
- Appveyor
- Dockerfile

## Node.js

- CircleCI
- `grafana/build-container`
- Appveyor
- Dockerfile

## Go dependencies

The Grafana project uses [Go modules](https://golang.org/cmd/go/#hdr-Modules__module_versions__and_more) to manage dependencies on external packages. This requires a working Go environment with version 1.11 or greater installed.

> **Note:** Since most developers of Grafana still use the `GOPATH` we need to specify `GO111MODULE=on` to make `go mod` and `got get` work as intended. If you have setup Grafana outside of the `GOPATH` on your machine you can skip `GO111MODULE=on` when running the commands below.

To add or update a new dependency, use the `go get` command:

```bash
# The GO111MODULE variable can be omitted when the code isn't located in GOPATH.
# Pick the latest tagged release.
GO111MODULE=on go get example.com/some/module/pkg

# Pick a specific version.
GO111MODULE=on go get example.com/some/module/pkg@vX.Y.Z
```

Tidy up the `go.mod` and `go.sum` files:

```bash
# The GO111MODULE variable can be omitted when the code isn't located in GOPATH.
GO111MODULE=on go mod tidy
```

You have to commit the changes to `go.mod` and `go.sum` before submitting the pull request.

## Node.js dependencies

Updated using `yarn`.

- `package.json`

## Where to make changes

### CircleCI

Our builds run on CircleCI through our build script.

#### Files

- `.circleci/config.yml`.

#### Dependencies

- nodejs
- golang
- grafana/build-container (our custom docker build container)

### grafana/build-container

The main build step (in CircleCI) is built using a custom build container that comes pre-baked with some of the necessary dependencies.

Link: [grafana/build-container](https://github.com/grafana/grafana/tree/master/scripts/build/ci-build)

#### Dependencies

- fpm
- nodejs
- golang
- crosscompiling (several compilers)

### Appveyor

Master and release builds trigger test runs on Appveyors build environment so that tests will run on Windows.

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

Please send out a notice in the grafana-dev slack channel when updating Go or Node.js to make it easier for everyone to update their local developer environments.
