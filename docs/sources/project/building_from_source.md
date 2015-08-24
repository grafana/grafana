---
page_title: Building from source
page_description: Building from source Grafana.
page_keywords: grafana, build, contribute, documentation
---

# Building Grafana from source

This guide will help you create packages from source and get grafana up and running in
dev environment. Grafana ships with its own required backend server; also completely open-source. It's written in [Go](http://golang.org) and has a full [HTTP API](/v2.1/reference/http_api/).

## Dependencies

- [Go 1.4](https://golang.org/dl/)
- [NodeJS](https://nodejs.org/download/)

## Get Code
Create a directory for the project and set your path accordingly. Then download and install Grafana into your $GOPATH directory
```
export GOPATH=`pwd`
mkdir -p $GOPATH/src/github.com/grafana
ln -s $GOPATH/src/github.com/raintank/grafana $GOPATH/src/github.com/grafana/grafana
go get github.com/raintank/grafana
```

## Building the backend
```
cd $GOPATH/src/github.com/grafana/grafana
go run build.go setup              # (only needed once to install godep)
$GOPATH/bin/godep restore          # (will pull down all golang lib dependecies in your current GOPATH)
go run build.go build              # (or 'go build .')
```

#### Building on Windows
The Grafana backend includes Sqlite3 which requires GCC to compile. So in order to compile Grafana on windows you need
to install GCC. We recommend [TDM-GCC](http://tdm-gcc.tdragon.net/download).

## Build the Front-end Assets

To build less to css for the frontend you will need a recent version of of node (v0.12.0),
npm (v2.5.0) and grunt (v0.4.5). Run the following:

```
npm install
npm install -g grunt-cli
grunt
```

## Recompile backend on source change
To rebuild on source change (requires that you executed godep restore)
```
go get github.com/Unknwon/bra
bra run
```

## Running Grafana Locally
You can run a local instance of Grafana by running:
```
./bin/grafana-server 
```
If you built the binary with `go run build.go build`, run `./bin/grafana-server`

If you built it with `go build .`, run `./grafana`

Open grafana in your browser (default [http://localhost:3000](http://localhost:3000)) and login with admin user (default user/pass = admin/admin).

## Developing for Grafana
To add features, customize your config, etc, you'll need to rebuild on source change (requires that you executed [godep restore](#build-the-backend), as outlined above). 
```
go get github.com/Unknwon/bra
bra run
```
You'll also need to run `grunt watch` to watch for changes to the front-end.

## Creating optimized release packages
This step builds linux packages and requires that fpm is installed. Install fpm via `gem install fpm`.

```
go run build.go build package
```

## Dev config

Create a custom.ini in the conf directory to override default configuration options.
You only need to add the options you want to override. Config files are applied in the order of:

1. grafana.ini
2. custom.ini

Learn more about Grafana config options in the [Configuration section](/installation/configuration/)

## Create a pull requests
Please contribute to the Grafana project and submit a pull request! Build new features, write or update documentation, fix bugs and generally make Grafana even more awesome.     

Before or after you create a pull request, sign the [contributor license agreement](/project/cla.html).
Together we can build amazing software faster. 
