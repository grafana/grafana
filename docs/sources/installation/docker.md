---
page_title: Installing using Docker
page_description: Grafana Installation guide using Docker container
page_keywords: grafana, installation, docker, container, guide
---

# Installing using Docker

## Install from offical docker image

Grafana has an official Docker container.

    $ docker run -i -p 3000:3000 grafana/grafana

All Grafana configuration settings can be defined using environment
variables, this is especially useful when using the above container.

## Docker volumes & ENV config

The Docker container exposes two volumes, the sqlite3 database in the
folder `/var/lib/grafana` and configuration files is in `/etc/grafana/`
folder. You can map these volumes to host folders when you start the
container:

    $ docker run -d -p 3000:3000 \
        -v /var/lib/grafana:/var/lib/grafana \
        -e "GF_SECURITY_ADMIN_PASSWORD=secret" \
        grafana/grafana:develop

In the above example I map the data folder and sets a configuration option via
an `ENV` instruction.

## Configuration

The back-end web server has a number of configuration options. Go the
[Configuration](../installation/configuration.md) page for details on all
those options.

