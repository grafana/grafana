---
page_title: Installing using Docker
page_description: Grafana Installation guide using Docker container
page_keywords: grafana, installation, docker, container, guide
---

# Installing using Docker

> **2.0.2 -> 2.1.0 Upgrade NOTICE!**
> The data and log paths were not correct in the previous image. The grafana database was placed by default in /usr/share/grafana/data instead of the correct path /var/lib/grafana. This means it was not in a dir that was marked as a volume. So if you remove the container it will remove the grafana database. So before updating make sure you copy the /usr/share/grafana/data path from inside the container to the host.

## Install from official docker image

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

