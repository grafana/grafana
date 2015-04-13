---
page_title: Installing using Docker
page_description: Grafana Installation guide using Docker container
page_keywords: grafana, installation, docker, container, guide
---

# Installing using Docker

## Install from offical docker image

Grafana has an offical docker container.

    $ docker run -i -p 3000:3000 grafana/grafana

All grafana configuration settings can be defined using ENVIRONMENT variables, this is especially useful when using the
above container.

## Docker volumes & ENV config

The docker container exposes two volumes, the sqlite3 database in the folder `/opt/grafana/data` and
configuration files in the `/opt/grafana/conf` folder. You can map these volumes to host folders when you start the container:

    $ docker run -d -p 3000:3000 \
        -v /var/grafana/data:/opt/grafana/data \
        -e "GF_SECURITY_ADMIN_PASSWORD=secret  \
        grafana/grafana:develop

In the above example I map the data folder and set a config option via an `ENV` variable.

## Configuration

The backend web server has a number of configuration options. Go the [Configuration](configuration) page for details
on all those options.

