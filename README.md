# Grafana - Graphite Dashboard
A beautiful, easy to use and feature rich Graphite dashboard replacement and graph editor. Visit [grafana.org](http://grafana.org) for screenshots and an overview.

![](http://grafana.org/assets/img/edit_dashboards.png)

# Features
## Graphite Target Editor
- Graphite target expression parser
- Quickly add / edit / remove function
- Function parameters can be easily changed
- Quickly navigate graphite metric structure
- Templating
- Integrated function documentation (TODO)
- Click &amp; drag functions to rearrange order (TODO)
- Much more...

## Graphing
- Fast rendering, even over large timespans.
- Click and drag to zoom.
- Multiple Y-axis.
- Bars, Lines, Points.
- Smart Y-axis formating
- Series toggles & color selector
- Axis labels
- Fullscreen views and more...

## Dashboards
- Create and edit dashboards
- Drag and drop graphs to rearrange
- Set column spans and row heights
- Save & search dashboards (ElasticSearch)
- Import & export dashboard (json file)
- Import dashboard from Graphite
- Templating
- Much more...

# Requirements
Grafana is very easy to install. It is a client side web app with no backend. Any webserver will do. Optionally you will need ElasticSearch if you want to be able to save and load dashboards quickly instead of json files or local storage.

# Installation
- Download and extract the [latest release](https://github.com/torkelo/grafana/releases).
- Edit config.js, then change graphiteUrl and elasticsearch to point to the correct urls. The urls entered here must be reachable by your browser.
- Point your browser to the installation.

To run from master:
- Clone this repository
- Start a web server in src folder
- Or create a optimized & minified build:
-- npm install (requires nodejs)
-- grunt build

When you have Grafana up an running, read the [Getting started](https://github.com/torkelo/grafana/wiki/Getting-started) guide for
an introduction on how to use Grafana.

# Graphite server config
If you haven't used an alternative dashboard for graphite before you need to enable cross-domain origin request. For Apache 2.x:
```
Header set Access-Control-Allow-Origin "*"
Header set Access-Control-Allow-Methods "GET, OPTIONS"
Header set Access-Control-Allow-Headers "origin, authorization, accept"
```

If your Graphite web is proteced by basic authentication, you have to enable the HTTP verb OPTIONS, origin
(no wildcards are allowed in this case) and add Access-Control-Allow-Credentials. This looks like the following for Apache:
```
Header set Access-Control-Allow-Origin "http://mygrafana.com:5656"
Header set Access-Control-Allow-Credentials true

<Location />
    AuthName "graphs restricted"
    AuthType Basic
    AuthUserFile /etc/apache2/htpasswd
    <LimitExcept OPTIONS>
      require valid-user
    </LimitExcept>
</Location>
```

# Roadmap
- Improve and refine the target parser and editing
- Improve graphite import feature
- Refine and simplify common tasks
- More panel types (not just graphs)
- Use elasticsearch to search for metrics
- Improve template support
- Annotate graph by querying ElasticSearch for events (or other event sources)
- Add support for other time series databases like InfluxDB

# Contribute
If you have any idea for an improvement or found a bug do not hesitate to open an issue. And if you have time clone this repo and submit a pull request and help me make Grafana the kickass metrics & devops dashboard we all dream about!

Clone repository:
- npm install
- grunt server (starts development web server in src folder)
- grunt (runs jshint and less -> css compilation)

# Notice
This software is based on the great log dashboard [kibana](https://github.com/elasticsearch/kibana).

# License
Grafana is distributed under Apache 2.0 License.