[Grafana](http://grafana.org)
================

This is Improbable's fork of Grafana 3.1, an open source, feature rich metrics dashboard and graph editor for
Graphite, Elasticsearch, OpenTSDB, Prometheus and InfluxDB.

- [What's New in Grafana 3.0](http://docs.grafana.org/guides/whats-new-in-v3/)

# Setup instructions

## Prerequisites

- `node.js` v4, `npm` v2
- `go` v1.5 or v1.6
- iLan or corpvpn network

Please note that the installation process for Grafana involves changing your `GOPATH` for the current shell session. Reopen your shell before doing any other Go development.

## 1. Check out repo into GOPATH

This step will download the Improbable Grafana code to a directory on your computer.

Open a shell in a directory where you are happy to make a directory for Grafana development. For this example it will be `~/Development`.

```
cd ~/Development
mkdir grafana
cd grafana
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

This step installs JS dependencies and compiles CSS for the frontend.

```
npm install -g grunt-cli
npm install
grunt
```

## 4. Run Grafana

If the previous steps worked, you should now be able to run Grafana locally. Make sure you have no other processes on port 3000 (e.g. the WebTools devserver) and run:
```
./bin/grafana-server
```
Open [localhost:3000](http://localhost:3000) in your browser and log in with the default admin user (username `admin`, password `admin`).

## 5. Set data source

This step sets up the Improbable data source in your locally running Grafana instance.

- Click on the Grafana logo on the top left corner of the screen and select `Data Sources`
- Click `Add data source`
- Choose type `Prometheus`, name `eu1-staging`, url `http://simmon.eu1-staging.internal.improbable.io:9090`
- Click `Add`

## 6. Import dashboard

This step imports an existing Infra dashboard into your local Grafana for testing.

- Click on the Grafana logo on the top left corner of the screen and select `Dashboards -> Import`
- Click `Upload .json File`
- Select the JSON file at `~/Development/grafana/src/github.com/improbable-io/grafana/sampledash.json`
- Enter a name for the dashboard and click `Save & Open`

You will see a dashboard with no data and an error alert. This is fine!




# Frontend development

To make customisations to the Grafana frontend code


### Dev config

Create a custom.ini in the conf directory to override default configuration options.
You only need to add the options you want to override. Config files are applied in the order of:

1. grafana.ini
2. dev.ini (if found)
3. custom.ini
