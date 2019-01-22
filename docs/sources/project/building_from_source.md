+++
title = "Building from source"
type = "docs"
[menu.docs]
parent = "installation"
weight = 5
+++

# Building Grafana from source

This guide will help you create packages from source and get grafana up and running in
dev environment. Grafana ships with its own required backend server; also completely open-source. It's written in [Go](http://golang.org) and has a full [HTTP API](/v2.1/reference/http_api/).

## Dependencies

- [Go (Latest Stable)](https://golang.org/dl/)
- [Git](https://git-scm.com/downloads)
- [NodeJS LTS](https://nodejs.org/download/)
- node-gyp is the Node.js native addon build tool and it requires extra dependencies: python 2.7, make and GCC. These are already installed for most Linux distros and MacOS. See the Building On Windows section or the [node-gyp installation instructions](https://github.com/nodejs/node-gyp#installation) for more details.

## Get Code
Create a directory for the project and set your path accordingly (or use the [default Go workspace directory](https://golang.org/doc/code.html#GOPATH)). Then download and install Grafana into your $GOPATH directory:

```bash
export GOPATH=`pwd`
go get github.com/grafana/grafana
```

On Windows use setx instead of export and then restart your command prompt:
```bash
setx GOPATH %cd%
```

You may see an error such as: `package github.com/grafana/grafana: no buildable Go source files`. This is just a warning, and you can proceed with the directions.

## Building the backend
```bash
cd $GOPATH/src/github.com/grafana/grafana
go run build.go setup
go run build.go build              # (or 'go build ./pkg/cmd/grafana-server')
```

#### Building on Windows

The Grafana backend includes Sqlite3 which requires GCC to compile. So in order to compile Grafana on windows you need to install GCC. We recommend [TDM-GCC](http://tdm-gcc.tdragon.net/download).

[node-gyp](https://github.com/nodejs/node-gyp#installation) is the Node.js native addon build tool and it requires extra dependencies to be installed on Windows. In a command prompt which is run as administrator, run:

```bash
npm --add-python-to-path='true' --debug install --global windows-build-tools
```

## Build the Frontend Assets

For this you need nodejs (v.6+).

```bash
npm install -g yarn
yarn install --pure-lockfile
yarn watch
```

## Running Grafana Locally
You can run a local instance of Grafana by running:

```bash
./bin/grafana-server
```
Or, if you built the binary with `go run build.go build`, run `./bin/<os>-<architecture>/grafana-server`

If you built it with `go build .`, run `./grafana`

Open grafana in your browser (default [http://localhost:3000](http://localhost:3000)) and login with admin user (default user/pass = admin/admin).

# Developing Grafana

To add features, customize your config, etc, you'll need to rebuild the backend when you change the source code. We use a tool named `bra` that
does this.

```bash
go get github.com/Unknwon/bra

bra run
```

You'll also need to run `yarn watch` to watch for changes to the front-end (typescript, html, sass)

### Running tests

- You can run backend Golang tests using `go test ./pkg/...`.
- Execute all frontend tests with `yarn test`

Writing & watching frontend tests

- Start watcher: `yarn jest`
- Jest will run all test files that end with the name ".test.ts"


## Creating optimized release packages

This step builds linux packages and requires that fpm is installed. Install fpm via `gem install fpm`.

```bash
go run build.go build package
```

## Dev config

Create a custom.ini in the conf directory to override default configuration options.
You only need to add the options you want to override. Config files are applied in the order of:

1. grafana.ini
2. custom.ini

### Set app_mode to development

In your custom.ini uncomment (remove the leading `;`) sign. And set `app_mode = development`.

Learn more about Grafana config options in the [Configuration section](/installation/configuration/)

## Create a pull requests
Please contribute to the Grafana project and submit a pull request! Build new features, write or update documentation, fix bugs and generally make Grafana even more awesome.

# Troubleshooting

**Problem**: PhantomJS or node-sass errors when running grunt

**Solution**: delete the node_modules directory. Install [node-gyp](https://github.com/nodejs/node-gyp#installation) properly for your platform. Then run `yarn install --pure-lockfile` again.
<br><br>

**Problem**: When running `bra run` for the first time you get an error that it is not a recognized command.

**Solution**: Add the bin directory in your Go workspace directory to the path. Per default this is `$HOME/go/bin` on Linux and `%USERPROFILE%\go\bin` on Windows or `$GOPATH/bin` (`%GOPATH%\bin` on Windows) if you have set your own workspace directory.
<br><br>

**Problem**: When executing a `go get` command on Windows and you get an error about the git repository not existing.

**Solution**: `go get` requires Git. If you run `go get` without Git then it will create an empty directory in your Go workspace for the library you are trying to get. Even after installing Git, you will get a similar error. To fix this, delete the empty directory (for example: if you tried to run `go get github.com/Unknwon/bra` then delete `%USERPROFILE%\go\src\github.com\Unknwon\bra`) and run the `go get` command again.
<br><br>

**Problem**: On Windows, getting errors about a tool not being installed even though you just installed that tool.

**Solution**: It is usually because it got added to the path and you have to restart your command prompt to use it.

## Logging in for the first time

To run Grafana open your browser and go to the default port http://localhost:3000 or the port you have configured.
Then follow the instructions [here](/guides/getting_started/).