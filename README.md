[Grafana](http://grafana.org)
================

This is Improbable's fork of Grafana 3.1, an open source, feature rich metrics dashboard and graph editor for
Graphite, Elasticsearch, OpenTSDB, Prometheus and InfluxDB.

- [What's New in Grafana 3.0](http://docs.grafana.org/guides/whats-new-in-v3/)

# Setup instructions

## Prerequisites

- `node.js` v4, `npm` v2
- `go` v1.5 or v1.6

Please note that the installation process for Grafana involves changing your `GOPATH` for the current shell session. Reopen your shell before doing any other Go development.

## 1. Check out repo into GOPATH

This step will download the Improbable Grafana code to a directory on your computer.

Open a shell in a directory where you are happy to make a directory for Grafana development. For this example it will be `~/Development`.

```
cd ~/Development
mkdir grafana
export GOPATH=`pwd`
mkdir $GOPATH/src/github.com/grafana
cd $GOPATH/src/github.com/grafana
git clone git@github.com:improbable-io/grafana.git
```

## 2. Build backend

This step will install `godep` and pull down the Go dependencies.

```
cd $GOPATH/src/github.com/grafana/grafana
go run build.go setup
godep restore
go run build.go build
```

## 3. Build frontend



```
```




## Requirements
There are no dependencies except an external time series data store. For dashboards and user accounts Grafana can use an embedded
database (sqlite3) or you can use an external SQL data base like MySQL or Postgres.

## Installation
Head to [grafana.org](http://docs.grafana.org/installation/) and [download](http://grafana.org/download/)
the latest release.

If you have any problems please read the [troubleshooting guide](http://docs.grafana.org/installation/troubleshooting/).

## Documentation & Support
Be sure to read the [getting started guide](http://docs.grafana.org/guides/gettingstarted/) and the other feature guides.

## Run from master
If you want to build a package yourself, or contribute. Here is a guide for how to do that. You can always find
the latest master builds [here](http://grafana.org/download/builds)

### Dependencies

- Go 1.5
- NodeJS v4+
- [Godep](https://github.com/tools/godep)

### Get Code

```bash
go get github.com/grafana/grafana
```

Since imports of dependencies use the absolute path github.com/grafana/grafana within the $GOPATH,
you will need to put your version of the code in $GOPATH/src/github.com/grafana/grafana to be able
to develop and build grafana on a cloned repository. To do so, you can clone your forked repository
directly to $GOPATH/src/github.com/grafana or you can create a symbolic link from your version
of the code to $GOPATH/src/github.com/grafana/grafana. The last options makes it possible to change
easily the grafana repository you want to build.
```bash
go get github.com/*your_account*/grafana
mkdir $GOPATH/src/github.com/grafana
ln -s  github.com/*your_account*/grafana $GOPATH/src/github.com/grafana/grafana
```

### Building the backend
```bash
cd $GOPATH/src/github.com/grafana/grafana
go run build.go setup            (only needed once to install godep)
godep restore                    (will pull down all golang lib dependencies in your current GOPATH)
go run build.go build
```

### Building frontend assets

To build less to css for the frontend you will need a recent version of of **node (v4+)**,
npm (v2.5.0) and grunt (v0.4.5). Run the following:

```bash
npm install
npm run build
```

To build the frontend assets only on changes:

```bash
sudo npm install -g grunt-cli # to do only once to install grunt command line interface
grunt watch
```

### Recompile backend on source change
To rebuild on source change (requires that you executed godep restore)
```bash
go get github.com/Unknwon/bra
bra run
```

### Running
```bash
./bin/grafana-server
```

Open grafana in your browser (default http://localhost:3000) and login with admin user (default user/pass = admin/admin).

### Dev config

Create a custom.ini in the conf directory to override default configuration options.
You only need to add the options you want to override. Config files are applied in the order of:

1. grafana.ini
2. dev.ini (if found)
3. custom.ini

## Create a pull request
Before or after you create a pull request, sign the [contributor license agreement](http://grafana.org/docs/contributing/cla.html).

## Contribute
If you have any idea for an improvement or found a bug do not hesitate to open an issue.
And if you have time clone this repo and submit a pull request and help me make Grafana
the kickass metrics & devops dashboard we all dream about!

Before creating a pull request be sure that "grunt test" runs without any style or unit test errors, also
please [sign the CLA](http://docs.grafana.org/project/cla/)

## License

Grafana is distributed under Apache 2.0 License.
Work in progress Grafana 2.0 (with included Grafana backend)
