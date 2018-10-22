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

Grafana is very easy to install and run using the official docker container.

```bash
$ docker run -d -p 3000:3000 grafana/grafana
```

## Configuration

All options defined in `conf/grafana.ini` can be overridden using environment
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

The back-end web server has a number of configuration options. Go to the
[Configuration]({{< relref "configuration.md" >}}) page for details on all
those options.

> For any changes to `conf/grafana.ini` (or corresponding environment variables) to take effect you need to restart Grafana by restarting the Docker container.

### Default Paths

The following settings are hard-coded when launching the Grafana Docker container and can only be overridden using environment variables, not in `conf/grafana.ini`.

Setting               | Default value
----------------------|---------------------------
GF_PATHS_CONFIG       | /etc/grafana/grafana.ini
GF_PATHS_DATA         | /var/lib/grafana
GF_PATHS_HOME         | /usr/share/grafana
GF_PATHS_LOGS         | /var/log/grafana
GF_PATHS_PLUGINS      | /var/lib/grafana/plugins
GF_PATHS_PROVISIONING | /etc/grafana/provisioning

## Running a Specific Version of Grafana

```bash
# specify right tag, e.g. 5.1.0 - see Docker Hub for available tags
$ docker run \
  -d \
  -p 3000:3000 \
  --name grafana \
  grafana/grafana:5.1.0
```

## Running the master branch

For every successful build of the master branch we update the `grafana/grafana:master` tag and create a new tag `grafana/grafana-dev:master-<commit hash>` with the hash of the git commit that was built. This means you can always get the latest version of Grafana.

When running Grafana master in production we **strongly** recommend that you use the `grafana/grafana-dev:master-<commit hash>` tag as that will guarantee that you use a specific version of Grafana instead of whatever was the most recent commit at the time.

For a list of available tags, check out [grafana/grafana](https://hub.docker.com/r/grafana/grafana/tags/) and [grafana/grafana-dev](https://hub.docker.com/r/grafana/grafana-dev/tags/). 

## Installing Plugins for Grafana

Pass the plugins you want installed to docker with the `GF_INSTALL_PLUGINS` environment variable as a comma separated list. This will pass each plugin name to `grafana-cli plugins install ${plugin}` and install them when Grafana starts.

```bash
docker run \
  -d \
  -p 3000:3000 \
  --name=grafana \
  -e "GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource" \
  grafana/grafana
```

## Building a custom Grafana image with pre-installed plugins

In the [grafana-docker](https://github.com/grafana/grafana/tree/master/packaging/docker)  there is a folder called `custom/` which includes a `Dockerfile` that can be used to build a custom Grafana image.  It accepts `GRAFANA_VERSION` and `GF_INSTALL_PLUGINS` as build arguments.

Example of how to build and run:
```bash
cd custom
docker build -t grafana:latest-with-plugins \
  --build-arg "GRAFANA_VERSION=latest" \
  --build-arg "GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource" .

docker run \
  -d \
  -p 3000:3000 \
  --name=grafana \
  grafana:latest-with-plugins
```

## Installing Plugins from other sources

> Only available in Grafana v5.3.1+

It's possible to install plugins from custom url:s by specifying the url like this: `GF_INSTALL_PLUGINS=<url to plugin zip>;<plugin name>`

```bash
docker run \
  -d \
  -p 3000:3000 \
  --name=grafana \
  -e "GF_INSTALL_PLUGINS=http://plugin-domain.com/my-custom-plugin.zip;custom-plugin" \
  grafana/grafana
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

## Grafana container with persistent storage (recommended)

```bash
# create a persistent volume for your data in /var/lib/grafana (database and plugins)
docker volume create grafana-storage

# start grafana
docker run \
  -d \
  -p 3000:3000 \
  --name=grafana \
  -v grafana-storage:/var/lib/grafana \
  grafana/grafana
```

## Grafana container using bind mounts

You may want to run Grafana in Docker but use folders on your host for the database or configuration. When doing so it becomes important to start the container with a user that is able to access and write to the folder you map into the container.

```bash
mkdir data # creates a folder for your data
ID=$(id -u) # saves your user id in the ID variable

# starts grafana with your user id and using the data folder
docker run -d --user $ID --volume "$PWD/data:/var/lib/grafana" -p 3000:3000 grafana/grafana:5.1.0
```

## Reading secrets from files (support for Docker Secrets)

> Only available in Grafana v5.2+.

It's possible to supply Grafana with configuration through files. This works well with [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/) as the secrets by default gets mapped into `/run/secrets/<name of secret>` of the container.

You can do this with any of the configuration options in conf/grafana.ini by setting `GF_<SectionName>_<KeyName>__FILE` to the path of the file holding the secret.

Let's say you want to set the admin password this way.

- Admin password secret: `/run/secrets/admin_password`
- Environment variable: `GF_SECURITY_ADMIN_PASSWORD__FILE=/run/secrets/admin_password`


## Migration from a previous version of the docker container to 5.1 or later

The docker container for Grafana has seen a major rewrite for 5.1.

**Important changes**

* file ownership is no longer modified during startup with `chown`
* default user id `472` instead of `104`
* no more implicit volumes
  - `/var/lib/grafana`
  - `/etc/grafana`
  - `/var/log/grafana`

### Removal of implicit volumes

Previously `/var/lib/grafana`, `/etc/grafana` and `/var/log/grafana` were defined as volumes in the `Dockerfile`. This led to the creation of three volumes each time a new instance of the Grafana container started, whether you wanted it or not.

You should always be careful to define your own named volume for storage, but if you depended on these volumes you should be aware that an upgraded container will no longer have them.

**Warning**: when migrating from an earlier version to 5.1 or later using docker compose and implicit volumes you need to use `docker inspect` to find out which volumes your container is mapped to so that you can map them to the upgraded container as well. You will also have to change file ownership (or user) as documented below.

### User ID changes

In 5.1 we switched the id of the grafana user. Unfortunately this means that files created prior to 5.1 won't have the correct permissions for later versions. We made this change so that it would be more likely that the grafana users id would be unique to Grafana. For example, on Ubuntu 16.04 `104` is already in use by the syslog user.

Version | User    | User ID
--------|---------|---------
< 5.1   | grafana | 104
>= 5.1  | grafana | 472

There are two possible solutions to this problem. Either you start the new container as the root user and change ownership from `104` to `472` or you start the upgraded container as user `104`.

#### Running docker as a different user

```bash
docker run --user 104 --volume "<your volume mapping here>" grafana/grafana:5.1.0
```

##### Specifying a user in docker-compose.yml
```yaml
version: "2"

services:
  grafana:
    image: grafana/grafana:5.1.0
    ports:
      - 3000:3000
    user: "104"
```

#### Modifying permissions

The commands below will run bash inside the Grafana container with your volume mapped in. This makes it possible to modify the file ownership to match the new container. Always be careful when modifying permissions.

```bash
$ docker run -ti --user root --volume "<your volume mapping here>" --entrypoint bash grafana/grafana:5.1.0

# in the container you just started:
chown -R root:root /etc/grafana && \
  chmod -R a+r /etc/grafana && \
  chown -R grafana:grafana /var/lib/grafana && \
  chown -R grafana:grafana /usr/share/grafana
```

## Logging in for the first time

To run Grafana open your browser and go to http://localhost:3000/. 3000 is the default http port that Grafana listens to if you haven't [configured a different port](/installation/configuration/#http-port).
Then follow the instructions [here](/guides/getting_started/).