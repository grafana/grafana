# Developer guide

This guide helps you get started developing Grafana.

Before you begin, you might want to read [How to contribute to Grafana as a junior dev](https://medium.com/@ivanahuckova/how-to-contribute-to-grafana-as-junior-dev-c01fe3064502) by [Ivana Huckova](https://medium.com/@ivanahuckova).


## Dependencies

Make sure you have the following dependencies installed before setting up your developer environment:

- [Git](https://git-scm.com/)
- [Go](https://golang.org/dl/) (see [go.mod](../go.mod#L3) for minimum required version)
- [Node.js (Long Term Support)](https://nodejs.org)
- [Yarn](https://yarnpkg.com)

### macOS

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
1. Open a terminal and run `go get github.com/grafana/grafana` in your terminal. This command downloads, and installs Grafana to your `$GOPATH`.
1. Open `$GOPATH/src/github.com/grafana/grafana` in your favorite code editor.

## Build Grafana

Grafana consists of two components; the _frontend_, and the _backend_.

### Frontend

Before we can build the frontend assets, we need to install the dependencies:

```
yarn install --pure-lockfile
```

After the command has finished, we can start building our source code:

```
yarn start
```

Once `yarn start` has built the assets, it will continue to do so whenever any of the files change. This means you don't have to manually build the assets every time you change the code.

Next, we'll build the web server that will serve the frontend assets we just built.

### Backend

Build and run the backend by running `make run` in the root directory of the repository. This command compiles the Go source code and starts a web server.

> Are you having problems with [too many open files](#troubleshooting)?

By default, you can access the web server at `http://localhost:3000/`.

Log in using the default credentials:

| username | password |
| -------- | -------- |
| `admin`  | `admin`  |

When you log in for the first time, Grafana asks you to change your password.

#### Building on Windows

The Grafana backend includes Sqlite3 which requires GCC to compile. So in order to compile Grafana on Windows you need to install GCC. We recommend [TDM-GCC](http://tdm-gcc.tdragon.net/download).

## Test Grafana

The test suite consists of three types of tests: _Frontend tests_, _backend tests_, and _end-to-end tests_.

### Run frontend tests

We use [jest](https://jestjs.io/) for our frontend tests. Run them using Yarn:

```
yarn jest
```

### Run backend tests

If you're developing for the backend, run the tests with the standard Go tool:

```
go test -v ./pkg/...
```

### Run end-to-end tests

The end to end tests in Grafana use [Cypress](https://www.cypress.io/) to run automated scripts in a headless Chromium browser. Read more about our [e2e framework](/contribute/style-guides/e2e.md). 

To run the tests:

```
yarn e2e-tests
```

By default, the end-to-end tests assumes Grafana is available on `localhost:3000`. To use a specific URL, set the `BASE_URL` environment variable:

```
BASE_URL=http://localhost:3333 yarn e2e-tests
```

To follow the tests in the browser while they're running, use the `yarn e2e-tests:debug` instead.

```
yarn e2e-tests:debug
```

## Configure Grafana for development

The default configuration, `grafana.ini`, is located in the `conf` directory. 

To override the default configuration, create a `custom.ini` file in the `conf` directory. You only need to add the options you wish to override.

Enable the development mode, by adding the following line in your `custom.ini`:

```
app_mode = development
```


### Add data sources

By now, you should be able to build and test a change you've made to the Grafana source code. In most cases, you need to add at least one data source to verify the change.

To set up data sources for your development environment, go to the [devenv](/devenv) directory in the Grafana repository:

```
cd devenv
```

Run the `setup.sh` script to set up a set of data sources and dashboards in your local Grafana instance. The script creates a set of data sources called **gdev-\<type\>**, and a set of dashboards located in a folder called **gdev dashboards**.

Some of the data sources require databases to run in the background.

Installing and configuring databases can be a tricky business. Grafana uses [Docker](https://docker.com) to make the task of setting up databases a little easier. Make sure you [install Docker](https://docs.docker.com/docker-for-mac/install/) before proceeding to the next step.

In the root directory of your Grafana repository, run the following command:

```
make devenv sources=influxdb,loki
```

The script generates a Docker Compose file with the databases you specify as `sources`, and runs them in the background.

See the repository for all the [available data sources](/devenv/docker/blocks). Note that some data sources have specific Docker images for macOS, e.g. `prometheus_mac`.

## Build a Docker image

To build a Docker image, run:

```
make build-docker-full
```

The resulting image will be tagged as grafana/grafana:dev.

**Note:** If you've already set up a local development environment, and you're running a `linux/amd64` machine, you can speed up building the Docker image:

1. Build the frontend: `go run build.go build-frontend`.
1. Build the Docker image: `make build-docker-dev`.

**Note:** If you are using Docker for macOS, be sure to set the memory limit to be larger than 2 GiB. Otherwise, `grunt build` may fail. The memory limit settings are available under **Docker Desktop** -> **Preferences** -> **Advanced**.

## Troubleshooting

Are you having issues with setting up your environment? Here are some tips that might help.

### Too many open files when running `make run`

Depending on your environment, you may have to increase the maximum number of open files allowed.

To see how many open files are allowed, run:

```
ulimit -a
```

To change the number of open files allowed, run:

```
ulimit -S -n 2048
```

The number of files needed may be different on your environment. To determine the number of open files needed by `make run`, run:

```
find ./conf ./pkg ./public/views | wc -l
```

Another alternative is to limit the files being watched. The directories that are watched for changes are listed in the `.bra.toml` file in the root directory. 

## Next steps

- Read our [style guides](/contribute/style-guides).
- Learn how to [Create a pull request](/contribute/create-pull-request.md).
- Read [How to contribute to Grafana as a junior dev](https://medium.com/@ivanahuckova/how-to-contribute-to-grafana-as-junior-dev-c01fe3064502) by [Ivana Huckova](https://medium.com/@ivanahuckova).
- Read about the [architecture](architecture).
