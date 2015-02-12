[Grafana](http://grafana.org) [![Build Status](https://api.travis-ci.org/grafana/grafana.svg)](https://travis-ci.org/grafana/grafana) [![Coverage Status](https://coveralls.io/repos/grafana/grafana/badge.png)](https://coveralls.io/r/grafana/grafana) [![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/grafana/grafana?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
================
[Website](http://grafana.org) |
[Twitter](http://twitter.com/grafana) |
[IRC](http://webchat.freenode.net/?channels=grafana) |
[Email](mailto:contact@grafana.org)

Grafana is An open source, feature rich metrics dashboard and graph editor for
Graphite, InfluxDB & OpenTSDB.

![](http://grafana.org/assets/img/start_page_bg.png)

# Grafana 2.0 Alpha branch [![wercker status](https://app.wercker.com/status/1de5ea38f93fd2dfa2eb8b8ba58b6df1/s "wercker status")](https://app.wercker.com/project/bykey/1de5ea38f93fd2dfa2eb8b8ba58b6df1)

Grafana 2.0 comes with a backend written in Go. It is not ready for production use yet as there is still a lot of small
issues to fix and polish missing. But feedback on what is done and bug reports would be greatly appreciated.

## Try it out with docker
```
docker run -i -p 3000:3000 grafana/grafana:develop
```
The default admin user is admin/admin.

## building and running

```
go get github.com/grafana/grafana
```
The above will give an error saying there is no go code. That is because the new backend parts are in the develop branch.

Building
```
cd $GOPATH/src/github.com/grafana/grafana
git checkout -t origin/develop
go run build.go setup            (only needed once to install godep)
godep restore                    (will pull down all golang lib dependecies in your current GOPATH)
go build .
```

To build less to css for the frontend you will need a recent version of of node (v0.12.0),
npm (v2.5.0) and grunt (v0.4.5). Run the following:

```
npm install
npm install -g grunt-cli
grunt
```

To rebuild on source change (requires that you executed godep restore)
```
go get github.com/Unknwon/bra
bra run
```

Running
```
./bin/grafana web
```
Open grafana in your browser (default http://localhost:3000) and login with admin user (default user/pass = admin/admin).

### Config
Create a grafana.custom.ini in the conf directory to override default configuration options.
You only need to add the options you want to override. Config files are applied in the order of:

1. grafana.ini
2. grafana.dev.ini (if found)
3. grafana.custom.ini

### Docs
There is no docs for the configuration and new UI views, or the account / user model yet. But a quick note
is that Grafana 2.0 has a multi tenant account & user model where Dashboards, data sources, api keys, etc are
tied to an account and not to a specific user. Users are coupled to accounts via an account user role (Admin, Editor, Viewer).
The default configuration is set to a single account mode to make this user & account model easier to handle in a single account setup.
User sign ups are automatically added to a main account with the Editor role (this can be overriden in the config file). The default
grafana admin user that is created on first startup also creates the main account.


## Features
### Graphite Target Editor
- Graphite target expression parser
- Feature rich query composer
- Quickly add and edit functions & parameters
- Templated queries
- [See it in action](http://grafana.org/docs/features/graphite)

### Graphing
- Fast rendering, even over large timespans.
- Click and drag to zoom.
- Multiple Y-axis.
- Bars, Lines, Points.
- Smart Y-axis formating
- Series toggles & color selector
- Legend values, and formating options
- Grid thresholds, axis labels
- [Annotations](http://grafana.org/docs/features/annotations)

### Dashboards
- Create, edit, save & search dashboards
- Change column spans and row heights
- Drag and drop panels to rearrange
- Use InfluxDB or Elasticsearch as dashboard storage
- Import & export dashboard (json file)
- Import dashboard from Graphite
- Templating
- [Scripted dashboards](http://grafana.org/docs/features/scripted_dashboards)
- [Dashboard playlists](http://grafana.org/docs/features/playlist)
- [Time range controls](http://grafana.org/docs/features/time_range)

### InfluxDB
- Use InfluxDB as a metric data source, annotation source and for dashboard storage
- Query editor with series and column typeahead, easy group by and function selection

### OpenTSDB
- Use as metric data source
- Query editor with metric name typeahead and tag filtering

## Requirements
There are no dependencies, Grafana is a client side application that runs in your browser. It only needs a time series store where it can fetch metrics. If you use InfluxDB Grafana can use it to store dashboards. If you use Graphite or OpenTSDB you can use Elasticsearch to store dashboards or just use json files stored on disk.

## Installation
Head to [grafana.org](http://grafana.org) and [download](http://grafana.org/download/)
the latest release.

Then follow the quick [setup & config guide](http://grafana.org/docs/). If you have any problems please
read the [troubleshooting guide](http://grafana.org/docs/troubleshooting).

## Documentation & Support
Be sure to read the [getting started guide](http://grafana.org/docs/features/intro) and the other
feature guides.

## Run from master
Grafana uses nodejs and grunt for asset management (css & javascript), unit test runner and javascript syntax verification.
- clone repository
- install nodejs
- npm install (in project root)
- npm install -g grunt-cli
- grunt   (runt default task that will generate css files)
- grunt build (creates optimized & minified release)
- grunt release (same as grunt build but will also create tar & zip package)
- grunt test (executes jshint and unit tests)

## Contribute
If you have any idea for an improvement or found a bug do not hesitate to open an issue.
And if you have time clone this repo and submit a pull request and help me make Grafana
the kickass metrics & devops dashboard we all dream about!

Before creating a pull request be sure that "grunt test" runs without any style or unit test errors, also
please [sign the CLA](http://grafana.org/docs/contributing/cla.html)

## License

Grafana is distributed under Apache 2.0 License.
Work in progress Grafana 2.0 (with included Grafana backend)

