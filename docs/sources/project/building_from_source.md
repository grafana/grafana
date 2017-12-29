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

- [Go 1.9.2](https://golang.org/dl/)
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
npm run build
```

## Running Grafana Locally
You can run a local instance of Grafana by running:

```bash
./bin/grafana-server
```
If you built the binary with `go run build.go build`, run `./bin/grafana-server`

If you built it with `go build .`, run `./grafana`

Open grafana in your browser (default [http://localhost:3000](http://localhost:3000)) and login with admin user (default user/pass = admin/admin).

## Developing Grafana

To add features, customize your config, etc, you'll need to rebuild the backend when you change the source code. We use a tool named `bra` that
does this.

```bash
go get github.com/Unknwon/bra

bra run
```

You'll also need to run `npm run watch` to watch for changes to the front-end (typescript, html, sass)

### Running tests

- You can run backend Golang tests using "go test ./pkg/...".
- Execute all frontend tests with "npm run test"

Writing & watching frontend tests (we have two test runners)

- jest for all new tests that do not require browser context (React+more)
   - Start watcher: `npm run jest`
   - Jest will run all test files that end with the name ".jest.ts"
- karma + mocha is used for testing angularjs components. We do want to migrate these test to jest over time (if possible).
  - Start watcher: `npm run karma`
  - Karma+Mocha runs all files that end with the name "_specs.ts".

## Creating optimized release packages

This step builds linux packages and requires that fpm is installed. Install fpm via `gem install fpm`.

```bash
go run build.go build package
```

### Compile Linux Packages in Docker

```
docker run -itv $PWD:/go/src/github.com/grafana/grafana -w /go/src/github.com/grafana/grafana ubuntu:xenial bash -c '
apt-get update &&
apt-get install -y software-properties-common &&
add-apt-repository -y ppa:gophers/archive &&
apt-get install -y curl &&
curl -sL https://deb.nodesource.com/setup_6.x | bash - &&
apt-get update &&
apt-get install -y rpm git golang-1.9-go nodejs ruby ruby-dev &&
gem install fpm &&
npm install -g yarn &&
yarn install --pure-lockfile &&
export PATH=/usr/lib/go-1.9/bin:$PWD/node_modules/.bin:$PATH &&
go run build.go build package
'
```

This will output packages in `dist/`.

### Build a Custom Docker Image

- Clone [grafana-docker](https://github.com/grafana/grafana-docker).
- Copy the `deb` package from `dist/` to where you checked out `grafana-docker`.
- Patch and build the image:

```shell
cat << 'PATCH' | git apply -
diff --git a/Dockerfile b/Dockerfile
index 5a56c94..91389de 100644
--- a/Dockerfile
+++ b/Dockerfile
@@ -1,11 +1,10 @@
 FROM debian:jessie
 
-ARG DOWNLOAD_URL
+COPY grafana_*_amd64.deb /tmp/grafana.deb
 
 RUN apt-get update && \
     apt-get -y --no-install-recommends install libfontconfig curl ca-certificates && \
     apt-get clean && \
-    curl ${DOWNLOAD_URL} > /tmp/grafana.deb && \
     dpkg -i /tmp/grafana.deb && \
     rm /tmp/grafana.deb && \
     curl -L https://github.com/tianon/gosu/releases/download/1.7/gosu-amd64 > /usr/sbin/gosu && \
PATCH

docker build -t grafana/grafana:local .
```

Now you can run `grafana/grafana:local`.

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

## Troubleshooting

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
