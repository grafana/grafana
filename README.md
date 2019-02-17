[Grafana](https://grafana.com) [![Circle CI](https://circleci.com/gh/grafana/grafana.svg?style=svg)](https://circleci.com/gh/grafana/grafana) [![Go Report Card](https://goreportcard.com/badge/github.com/grafana/grafana)](https://goreportcard.com/report/github.com/grafana/grafana) [![codecov](https://codecov.io/gh/grafana/grafana/branch/master/graph/badge.svg)](https://codecov.io/gh/grafana/grafana)
================
[Website](https://grafana.com) |
[Twitter](https://twitter.com/grafana) |
[Community & Forum](https://community.grafana.com)

Grafana is an open source, feature rich metrics dashboard and graph editor for
Graphite, Elasticsearch, OpenTSDB, Prometheus and InfluxDB.

![](https://www.grafanacon.org/2019/images/grafanacon_la_nav-logo.png)

Join us Feb 25-26 in Los Angeles, California for GrafanaCon - a two-day event with talks focused on Grafana and the surrounding open source monitoring ecosystem. Get deep dives into Loki, the Explore workflow and all of the new features of Grafana 6, plus participate in hands on workshops to help you get the most out of your data. 

Time is running out - grab your ticket now! http://grafanacon.org

<!---
![](http://docs.grafana.org/assets/img/features/dashboard_ex1.png)
-->

## Installation
Head to [docs.grafana.org](http://docs.grafana.org/installation/) for documentation or [download](https://grafana.com/get) to get the latest release.

## Documentation & Support
Be sure to read the [getting started guide](http://docs.grafana.org/guides/gettingstarted/) and the other feature guides.

## Run from master
If you want to build a package yourself, or contribute - here is a guide for how to do that. You can always find
the latest master builds [here](https://grafana.com/grafana/download)

### Dependencies

- Go (Latest Stable)
  - bra [`go get github.com/Unknwon/bra`]
- Node.js LTS
  - yarn [`npm install -g yarn`]

### Get the project

**The project located in the go-path will be your working directory.**

```bash
go get github.com/grafana/grafana
cd $GOPATH/src/github.com/grafana/grafana
```

### Building

#### The backend

```bash
go run build.go setup
go run build.go build
```

#### Frontend assets

*For this you need Node.js (LTS version).*

```bash
yarn install --pure-lockfile
```

### Run and rebuild on source change

#### Backend

To run the backend and rebuild on source change:

```bash
$GOPATH/bin/bra run
```

#### Frontend

Rebuild on file change, and serve them by Grafana's webserver (http://localhost:3000):

```bash
yarn watch
```

Build the assets, rebuild on file change with Hot Module Replacement (HMR), and serve them by webpack-dev-server (http://localhost:3333):

```bash
yarn start
# OR set a theme
env GRAFANA_THEME=light yarn start
```

*Note: HMR for Angular is not supported. If you edit files in the Angular part of the app, the whole page will reload.*

Run tests and rebuild on source change:

```bash
yarn jest
```

**Open grafana in your browser (default: e.g. `http://localhost:3000`) and login with admin user (default: `user/pass = admin/admin`).**

### Building a Docker image

There are two different ways to build a Grafana docker image. If your machine is setup for Grafana development and you run linux/amd64 you can build just the image. Otherwise, there is the option to build Grafana completely within Docker.

Run the image you have built using: `docker run --rm -p 3000:3000 grafana/grafana:dev`

#### Building on linux/amd64 (fast)

1. Build the frontend `go run build.go build-frontend`
2. Build the docker image `make build-docker-dev`

The resulting image will be tagged as `grafana/grafana:dev`

#### Building anywhere (slower)

Choose this option to build on platforms other than linux/amd64 and/or not have to setup the Grafana development environment.

1. `make build-docker-full` or `docker build -t grafana/grafana:dev .`

The resulting image will be tagged as `grafana/grafana:dev`

Notice: If you are using Docker for MacOS, be sure to set the memory limit to be larger than 2 GiB (at docker -> Preferences -> Advanced), otherwise `grunt build` may fail.

### Dev config

Create a custom.ini in the conf directory to override default configuration options.
You only need to add the options you want to override. Config files are applied in the order of:

1. grafana.ini
1. custom.ini

In your custom.ini uncomment (remove the leading `;`) sign. And set `app_mode = development`.

### Running tests

#### Frontend
Execute all frontend tests
```bash
yarn test
```

Writing & watching frontend tests

- Start watcher: `yarn jest`
- Jest will run all test files that end with the name ".test.ts"

#### Backend
```bash
# Run Golang tests using sqlite3 as database (default)
go test ./pkg/...

# Run Golang tests using mysql as database - convenient to use /docker/blocks/mysql_tests
GRAFANA_TEST_DB=mysql go test ./pkg/...

# Run Golang tests using postgres as database - convenient to use /docker/blocks/postgres_tests
GRAFANA_TEST_DB=postgres go test ./pkg/...
```

## Contribute

If you have any ideas for improvement or have found a bug, do not hesitate to open an issue.
And if you have time, clone this repo and submit a pull request to help me make Grafana
the kickass metrics & devops dashboard we all dream about! 

Read the [contributing](https://github.com/grafana/grafana/blob/master/CONTRIBUTING.md) guide then check the [`beginner friendly`](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+label%3A%22beginner+friendly%22) label to find issues that are easy and that we would like help with.

## Plugin development

Checkout the [Plugin Development Guide](http://docs.grafana.org/plugins/developing/development/) and checkout the [PLUGIN_DEV.md](https://github.com/grafana/grafana/blob/master/PLUGIN_DEV.md) file for changes in Grafana that relate to
plugin development.

## License

Grafana is distributed under [Apache 2.0 License](https://github.com/grafana/grafana/blob/master/LICENSE.md).

