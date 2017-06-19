[Grafana](https://grafana.com) [![Circle CI](https://circleci.com/gh/grafana/grafana.svg?style=svg)](https://circleci.com/gh/grafana/grafana)
================
[Website](https://grafana.com) |
[Twitter](https://twitter.com/grafana) |
[Community & Forum](https://community.grafana.com)

Grafana is an open source, feature rich metrics dashboard and graph editor for
Graphite, Elasticsearch, OpenTSDB, Prometheus and InfluxDB.

![](http://docs.grafana.org/assets/img/features/dashboard_ex1.png)

- [Install instructions](http://docs.grafana.org/installation/)
- [What's New in Grafana 2.0](http://docs.grafana.org/guides/whats-new-in-v2/)
- [What's New in Grafana 2.1](http://docs.grafana.org/guides/whats-new-in-v2-1/)
- [What's New in Grafana 2.5](http://docs.grafana.org/guides/whats-new-in-v2-5/)
- [What's New in Grafana 3.0](http://docs.grafana.org/guides/whats-new-in-v3/)
- [What's New in Grafana 4.0](http://docs.grafana.org/guides/whats-new-in-v4/)
- [What's New in Grafana 4.1](http://docs.grafana.org/guides/whats-new-in-v4-1/)
- [What's New in Grafana 4.2](http://docs.grafana.org/guides/whats-new-in-v4-2/)
- [What's New in Grafana 4.3](http://docs.grafana.org/guides/whats-new-in-v4-3/)

## Features

### Graphing
- Fast rendering, even over large timespans
- Click and drag to zoom
- Multiple Y-axis, logarithmic scales
- Bars, Lines, Points
- Smart Y-axis formatting
- Series toggles & color selector
- Legend values, and formatting options
- Grid thresholds, axis labels
- [Annotations](http://docs.grafana.org/reference/annotations/)
- Any panel can be rendered to PNG (server side using phantomjs)

### Dashboards
- Create, edit, save & search dashboards
- Change column spans and row heights
- Drag and drop panels to rearrange
- [Templating](http://docs.grafana.org/reference/templating/)
- [Scripted dashboards](http://docs.grafana.org/reference/scripting/)
- [Dashboard playlists](http://docs.grafana.org/reference/playlist/)
- [Time range controls](http://docs.grafana.org/reference/timerange/)
- [Share snapshots publicly](http://docs.grafana.org/v2.0/reference/sharing/)

### InfluxDB
- Use InfluxDB as a metric data source, annotation source
- Query editor with field and tag typeahead, easy group by and function selection

### Graphite
- Graphite target expression parser
- Feature rich query composer
- Quickly add and edit functions & parameters
- Templated queries
- [See it in action](http://docs.grafana.org/datasources/graphite/)

### Elasticsearch, Prometheus & OpenTSDB
- Feature rich query editor UI

### Alerting
- Define alert rules using graphs & query conditions
- Schedule & evalute alert rules, send notifications to Slack, Hipchat, Email, PagerDuty, etc.

## Requirements
There are no dependencies except an external time series data store. For dashboards and user accounts Grafana can use an embedded
database (sqlite3) or you can use an external SQL data base like MySQL or Postgres.

## Installation
Head to [grafana.org](http://docs.grafana.org/installation/) and [download](https://grafana.com/get)
the latest release.

If you have any problems please read the [troubleshooting guide](http://docs.grafana.org/installation/troubleshooting/).

## Documentation & Support
Be sure to read the [getting started guide](http://docs.grafana.org/guides/gettingstarted/) and the other feature guides.

## Run from master
If you want to build a package yourself, or contribute. Here is a guide for how to do that. You can always find
the latest master builds [here](https://grafana.com/grafana/download)

### Dependencies

- Go 1.8.1
- NodeJS LTS

### Get Code

```bash
go get github.com/grafana/grafana
```

Since imports of dependencies use the absolute path `github.com/grafana/grafana` within the `$GOPATH`,
you will need to put your version of the code in `$GOPATH/src/github.com/grafana/grafana` to be able
to develop and build grafana on a cloned repository. To do so, you can clone your forked repository
directly to `$GOPATH/src/github.com/grafana` or you can create a symbolic link from your version
of the code to `$GOPATH/src/github.com/grafana/grafana`. The last options makes it possible to change
easily the grafana repository you want to build.
```bash
go get github.com/*your_account*/grafana
mkdir $GOPATH/src/github.com/grafana
ln -s  $GOPATH/src/github.com/*your_account*/grafana $GOPATH/src/github.com/grafana/grafana
```

### Building the backend
```bash
cd $GOPATH/src/github.com/grafana/grafana
go run build.go setup
go run build.go build
```

### Building frontend assets

To build less to css for the frontend you will need a recent version of **node (v6+)**,
npm (v2.5.0) and grunt (v0.4.5). Run the following:

```bash
npm install -g yarn
yarn install --pure-lockfile
npm run build
```

To build the frontend assets only on changes:

```bash
sudo npm install -g grunt-cli # to do only once to install grunt command line interface
grunt watch
```

### Recompile backend on source change
To rebuild on source change.
```bash
go get github.com/Unknwon/bra
bra run
```

### Running
```bash
./bin/grafana-server
```

Open grafana in your browser (default: `http://localhost:3000`) and login with admin user (default: `user/pass = admin/admin`).

### Dev config

Create a custom.ini in the conf directory to override default configuration options.
You only need to add the options you want to override. Config files are applied in the order of:

1. grafana.ini
1. custom.ini

## Create a pull request
Before or after you create a pull request, sign the [contributor license agreement](http://docs.grafana.org/project/cla/).

## Contribute
If you have any idea for an improvement or found a bug do not hesitate to open an issue.
And if you have time clone this repo and submit a pull request and help me make Grafana
the kickass metrics & devops dashboard we all dream about!

## License
Grafana is distributed under Apache 2.0 License.
Work in progress Grafana 2.0 (with included Grafana backend)
