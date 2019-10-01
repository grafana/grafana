+++
title = "Developing on macOS"
description = "Developing on macOS"
type = "docs"
[menu.docs]
parent = "development"
weight = 1
+++

# Developing on macOS

This guide helps you get started developing Grafana on macOS.

## Dependencies

Make sure you have the following dependencies installed before moving on to set up your developer environment:

- [Git](https://git-scm.com/)
- [Go](https://golang.org/dl/)
- [Node.js (Long Term Support)](https://nodejs.org)
- [Yarn](https://yarnpkg.com)

We recommend using [Homebrew](https://brew.sh/) for installing any missing dependencies:

```
brew install git
brew install go
brew install node

npm install -g yarn
```

## Download Grafana

We recommend using Go to download the source code for the Grafana project:

1. Add `export GOPATH=$HOME/go/` to the bottom of your `$HOME/.bash_profile`.
1. Open a terminal and run `go get github.com/grafana/` in your terminal. This command downloads, and installs Grafana to your `$GOPATH`.
1. Open `$GOPATH/src/github.com/grafana/grafana` in your favorite code editor.

## Build Grafana

Grafana consists of two components; the _frontend_, and the _backend_.

### Frontend

Before we can build the frontend assets, we need to install the dependencies:

```
yarn install --pure-lockfile
```

When this is done, we can start building our source code:

```
yarn start
```

Once `yarn start` has built the assets it will continue to do so whenever any of the files change. This means you don't have to manually build the assets whenever you've made a change to the code.

Next, we'll build the web server that will serve the frontend assets we just built.

### Backend

Build and run the backend, by running `make run` in the root directory of the repository. This command will compile the Go source code, and start a web server.

By default, the web server will be served at `http://localhost:3000/`.

Log in using the default credentials:

| username | password |
|----------|----------|
| `admin`  | `admin` |

When you log in for the first time, you'll be asked to change your password.

## Test Grafana

The tests for the frontend are written using [jest](https://jestjs.io/). Run them using yarn:

```
yarn jest
```

If you're developing for the backend, run the tests with the standard Go tool:

```
go test -v ./pkg/...
```

## Add data sources

By now, you should be able to build and test a change you've made to the Grafana source code. Most likely though, you're going to need to add a few data sources to verify the change you made.

To set up data sources for your development environment, go to the `devenv` directory in the Grafana repository:

```
cd devenv
```

Run the `setup.sh` script to setup a set of data sources and dashboards in your local Grafana. Data sources are named **gdev-\<type\>**, and dashboards are located in a folder called **gdev dashboards**.

Some of the data sources require databases to run in the background.

Installing and configuring databases can be a tricky business. Grafana uses [Docker](https://docker.com) to make the task of setting up databases a little easier. Make sure you [install Docker](https://docs.docker.com/docker-for-mac/install/) before proceeding to the next step.

In the root directory of your Grafana repository, run the following command:

```
make devenv sources=influxdb,loki
```

The script generates a Docker Compose file with the databases you specify as `sources`, and runs them in the background.

See the repository for all the [available data sources](https://github.com/grafana/grafana/tree/master/devenv/docker/blocks). Note that some data sources have specific Docker images for macOS, e.g. `prometheus_mac`.

## Learn more

- [How to contribute to Grafana as a junior dev](https://medium.com/@ivanahuckova/how-to-contribute-to-grafana-as-junior-dev-c01fe3064502) by [Ivana Huckova](https://medium.com/@ivanahuckova).
