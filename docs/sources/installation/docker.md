+++
title = "Installing using Docker"
description = "Installing Grafana using Docker guide"
keywords = ["grafana", "configuration", "documentation", "docker"]
type = "docs"
[menu.docs]
name = "Installing using Docker"
identifier = "docker"
parent = "installation"
weight = 4
+++

# Installing using Docker

Grafana is very easy to install and run using the offical docker container.

```bash
$ docker run -d -p 3000:3000 grafana/grafana
```

All Grafana configuration settings can be defined using environment
variables, this is especially useful when using the above container.

## Docker volumes & ENV config

The Docker container exposes two volumes, the sqlite3 database in the
folder `/var/lib/grafana` and configuration files is in `/etc/grafana/`
folder. You can map these volumes to host folders when you start the
container:

```bash
$ docker run -d -p 3000:3000 \
    -v /var/lib/grafana:/var/lib/grafana \
    -e "GF_SECURITY_ADMIN_PASSWORD=secret" \
    grafana/grafana
```

In the above example I map the data folder and sets a configuration option via
an `ENV` instruction. 

See the [docker volumes documentation](https://docs.docker.com/engine/admin/volumes/volumes/) if you want to create a volume to use with the Grafana docker image instead of a bind mount (binding to a directory in the host system).

## Configuration

All options defined in conf/grafana.ini can be overridden using environment
variables by using the syntax `GF_<SectionName>_<KeyName>`.
For example:

```bash
$ docker run \
  -d \
  -p 3000:3000 \
  --name=grafana \
  -e "GF_SERVER_ROOT_URL=http://grafana.server.name" \
  -e "GF_SECURITY_ADMIN_PASSWORD=secret" \
  grafana/grafana
```

You can use your own grafana.ini file by using environment variable `GF_PATHS_CONFIG`.

The back-end web server has a number of configuration options. Go to the
[Configuration]({{< relref "configuration.md" >}}) page for details on all
those options.

## Installing Plugins for Grafana

Pass the plugins you want installed to docker with the `GF_INSTALL_PLUGINS` environment variable as a comma separated list. This will pass each plugin name to `grafana-cli plugins install ${plugin}`.

```bash
docker run \
  -d \
  -p 3000:3000 \
  --name=grafana \
  -e "GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource" \
  grafana/grafana
```

## Running a Specific Version of Grafana

```bash
# specify right tag, e.g. 4.5.2 - see Docker Hub for available tags
$ docker run \
  -d \
  -p 3000:3000 \
  --name grafana \
  grafana/grafana:5.0.2
```

## Configuring AWS Credentials for CloudWatch Support

```bash
$ docker run \
  -d \
  -p 3000:3000 \
  --name=grafana \
  -e "GF_AWS_PROFILES=default" \
  -e "GF_AWS_default_ACCESS_KEY_ID=YOUR_ACCESS_KEY" \
  -e "GF_AWS_default_SECRET_ACCESS_KEY=YOUR_SECRET_KEY" \
  -e "GF_AWS_default_REGION=us-east-1" \
  grafana/grafana
```

You may also specify multiple profiles to `GF_AWS_PROFILES` (e.g.
`GF_AWS_PROFILES=default another`).

Supported variables:

- `GF_AWS_${profile}_ACCESS_KEY_ID`: AWS access key ID (required).
- `GF_AWS_${profile}_SECRET_ACCESS_KEY`: AWS secret access  key (required).
- `GF_AWS_${profile}_REGION`: AWS region (optional).
