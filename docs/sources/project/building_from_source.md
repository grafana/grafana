---
page_title: Building from source
page_description: Building from source Grafana.
page_keywords: grafana, build, contribute, documentation
---

# Building Grafana from source

Guide for creating packages from source, and for getting grafana up and running in
dev environment.

## Dependencies

- Go 1.4
- NodeJS

## Get Code

```
export GOPATH=`pwd`
go get github.com/grafana/grafana
```

## Building the backend
```
cd $GOPATH/src/github.com/grafana/grafana
go run build.go setup            (only needed once to install godep)
$GOPATH/bin/godep restore                    (will pull down all golang lib dependecies in your current GOPATH)
go build .
```

## Building on Windows
The Grafana backend includes Sqlite3 which requires GCC to compile. So in order to compile Grafana on windows you need
to install GCC. We recommend [TDM-GCC](http://tdm-gcc.tdragon.net/download).

## Building frontend assets

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

## Running
```
./grafana-server
```

Open grafana in your browser (default http://localhost:3000) and login with admin user (default user/pass = admin/admin).

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

## Create a pull requests

Before or after your create a pull requests, sign the [contributor license agreement](/project/cla.html).
