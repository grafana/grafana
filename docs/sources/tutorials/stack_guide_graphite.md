---
page_title: Graphite + Grafana + StatsD - Stack Setup Guide
page_description: Installation and configuration guide & how to for Grafana, Graphite & StatsD
page_keywords: grafana, tutorials, graphite, statsd, setup, configuration, howto, installation
author: Torkel Ödegaard
---

# Stack Setup & Config Guide: Graphite + Grafana + StatsD

This lengthy article will guide you through installation, configuration and getting started with the amazing metric
stack that is composed of Graphite, Grafana and StatsD.

Graphite is still king when it comes to time series databases due to its simple data model, ingestion
with integrated aggregation & rollups, amazing query features and speed. No other time series
database has yet to match Graphite's query flexibility and analytics potential.

Graphite has a reputation for being tricky to install and scale. This guide aims to show
that is not really the case, or, at least, that it is a lot better than you expect.

> This guides does not only aim to be only be an install guide but to also teach you
> of the mechanics of metric collection, aggregation and querying. How Graphite
> stores and aggregates data is very important to understand in order to not
> get mislead by graphs.

## Installation - Ubuntu

This guides will require you to install 4 components.

- Carbon is the graphite ingestion deamon responsible for
receiving metrics and storing them.
- Graphite-api is light weight version of graphite-web with only the HTTP api and is
responsible for executing metric queries.
- StatsD is a metrics aggregation daemon that makes it easy for apps on
many machines to send measurements like timings and counters and have them aggregated or percentiles calculated.
- Grafana as the frontend to visualize metrics and the tool to help you build metric
queries that will make the most out of your collected metrics.

### Carbon

Graphite & Carbon are written in python, so we will start by installing python packages.

```
apt-get install \
    git \
    build-essential \
    libffi-dev libcairo2-dev \
    python-django \
    python-django-tagging \
    python-simplejson \
    python-memcache \
    python-ldap \
    python-cairo \
    python-twisted \
    python-pysqlite2 \
    python-support \
    python-dev \
    python-pip
```

Next we will clone carbon and whisper and install these components. Whisper is just a lib used
by carbon to write metrics to disk.

    cd /usr/local/src
    git clone https://github.com/graphite-project/carbon.git
    git clone https://github.com/graphite-project/whisper.git

    cd whisper && python setup.py install && cd ..
    cd carbon && python setup.py install && cd ..

### Configure carbon.conf

Copy example carbon config:
```
cp /opt/graphite/conf/carbon.conf.example /opt/graphite/conf/carbon.conf
```

Edit the config file `/opt/graphite/conf/carbon.conf`, find line `ENABLE_UPD_LISTENER` and
change this setting to `True`.

### Configure storage-schemas.conf

Create a new file at `/opt/graphite/conf/storage-schemas.conf` with the following content:

```
[carbon]
pattern = ^carbon\..*
retentions = 1m:30d,10m:1y,1h:5y

[default]
pattern = .*
retentions = 10s:1d,1m:7d,10m:1y
```

This config specifies the resolution of metrics and the retention periods. For example for all metrics begining with the word `carbon` receive metrics every minute and store for 30 days, then
roll them up into 10 minute buckets and store those for 1 year, then roll those up into 1 hour buckets and store those for 5 years. For all other metrics
the default rule will be applied with other retention periods.

This configuration is very important, as the first retention period must match the rate of which you send metrics. The default rule has 10 seconds
as its first resolution so when configuring StatsD we should configure it to send metrics every 10 seconds.

> If you send values more frequently than the highest resolution, for example if you send data every second but
> the storage schema rules defines the highest resolution to be 10 seconds, then the values you send will just
> overwrite each other and the last value sent during every 10 second period will be saved. StatsD can work around this
> problem.

### Configure storage-aggregation.conf

Copy the default config and open it in an editor.
```
cp /opt/graphite/conf/storage-aggregation.conf.example /opt/graphite/conf/storage-aggregation.conf
```

Example config:
```
[min]
pattern = \.min$
xFilesFactor = 0.1
aggregationMethod = min

[max]
pattern = \.max$
xFilesFactor = 0.1
aggregationMethod = max

[sum]
pattern = \.count$
xFilesFactor = 0
aggregationMethod = sum

[default_average]
pattern = .*
xFilesFactor = 0.5
aggregationMethod = average
```

You do not really need to change the default config, but is very important to
understand what the config controls and what implications that it has. Graphite
does rollups as part of the metric ingestion according to the rules defined in
`storage-schemas.conf`. For example, given storage schema rule `10s:1d,1m:7d`,
when aggregating 6 values (each representing 10 seconds) into a 1min bucket graphite
will use an `aggregationMethod` like for example `average`. What method to use
will be determined by the rules specified in `storage-aggregation.conf`.

The default rules all look at the metric path ending. Does it end with `.count` then use `sum` when doing rollups, does it end with `max` then use `max` function, and if it does not
end with max, min or count then use average. This means that naming metrics is very important! But don't worry if you use StatsD it will send the correct names to graphite.

### Start carbon
Lets install supervisord and let it start carbon.

`apt-get install supervisor`

Create a new file in `/etc/supervisor/conf.d/carbon.conf` with the following:

```
[program:carbon-cache]
command = /opt/graphite/bin/carbon-cache.py --debug start
stdout_logfile = /var/log/supervisor/%(program_name)s.log
stderr_logfile = /var/log/supervisor/%(program_name)s.log
autorestart = true
stopsignal = QUIT
```

```
supervisorctl reload
```

### Graphite-api

Graphite api is a light weight version of graphite-web with only the api component (no web ui). It is dead simple
to install.

```
pip install gunicorn graphite-api
```

You should now have a graphite-api daemon running with an open HTTP api port of 8888.

### Configuring Graphite-api

Create a file `/etc/graphite-api.yaml` with an editor and set it's content to:

```
search_index: /opt/graphite/storage/index
finders:
  - graphite_api.finders.whisper.WhisperFinder
functions:
  - graphite_api.functions.SeriesFunctions
  - graphite_api.functions.PieFunctions
whisper:
  directories:
    - /opt/graphite/storage/whisper
time_zone: UTC
```

Lets create a supervisor file for graphite-api at `/etc/supervisor/graphite-api.conf`

```
[program:graphite-api]
command = gunicorn -b 0.0.0.0:8888 -w 2 --log-level info graphite_api.app:app
stdout_logfile = /var/log/supervisor/%(program_name)s.log
stderr_logfile = /var/log/supervisor/%(program_name)s.log
autorestart = true
stopsignal = QUIT
```

Reload supervisor

    supervisorctl reload

A carbon-cache deamon and graphite-api should now be running. Type `supervisorctl status` to verify that they are running. You can
also open `http://your_server_ip:8888/metrics/find?query?*` in your browser. You should see a json snippet.


### Install Grafana

    cd /tmp/
    wget https://grafanarel.s3.amazonaws.com/builds/grafana_2.1.1_amd64.deb
    sudo dpkg -i grafana_2.1.1_amd64.deb
    sudo service grafana-server start

Grafana should now be running with default config on port 3000.

## Grafana - first steps

### Add data source

Open http://your_server_ip:3000 in your browser and login with the default user and password (`admin/admin`).

- Click on `Data Sources` on the side menu.
- Click on `Add new` in the top menu
- Specify name `graphite` and check the `Default ` checkbox
- Specify Url `http://localhost:8888` and Access `proxy`
- Click `Add ` button

### Your first dashboard

- Click on `Dashboards`
- Click on `Home` button in the top menu, this should open the dashboard search dropdown
- Click on `New` button in the bottom of this dropdown

### Add a graph

- Click on the green icon to the left to open the row menu
- Select `Add Panel` > `Graph` from the row menu
- An empty graph panel should appear with title `no title (click here)`. Click on this title and then `Edit`
- This will open the graph in edit mode and take you to the metrics tab.
- There is one query already added (asigned letter A) but it is empty.
- Click on `select metric` to pick the first graphite metric node. A new `select metric` link will appear until you reached a leaf node.
- Try picking the metric paths for `carbon.agents.<server name>.cpuUsage`, you should now see a line appear in the graph!

## Writing metrics to Graphite
Graphite has the simples metric write protocol imaginable. Something that has surely contributed to its wide adoption by metric
frameworks and numerous integrations.

    prod.server1.requests.count 10 1398969187

    <metric.name.and.path> <metric value> <unix_epoch_time_stamp_in_seconds>

There are hundreds of tools and instrumentation frameworks that can send metrics using this protocol.

## Installing StatsD

StatsD is To make it easier for applications to send metrics and timings

### Inserting metrics
