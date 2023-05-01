---
aliases:
  - ../administration/configure-docker/
  - ../installation/configure-docker/
description: Guide for configuring the Grafana Docker image
keywords:
  - grafana
  - configuration
  - documentation
  - docker
  - docker compose
title: Configure Docker image
weight: 1800
---

# Configure a Grafana Docker image

Running Grafana on Docker may require some additional configuration which depends on the complexity of your environment. We will explain some of those e.g. using different images, changing logging levels, defining secrets on Cloud (e.g. AWS), configuring plugins etc.

> **Note:** These examples use the Grafana Enterprise docker image. You can use the Grafana Open Source edition by changing the docker image to `grafana/grafana-oss`.

# Supported Docker Image variants

You can install and run Grafana using the following official Docker images.

**Grafana Enterprise**: `grafana/grafana-enterprise`

**Grafana Open Source**: `grafana/grafana-oss`

Each edition is available in two variants: Alpine and Ubuntu. See below.

## Alpine image (recommended)

The default images are based on the popular [Alpine Linux project](http://alpinelinux.org/), available in the [Alpine official image](https://hub.docker.com/_/alpine). Alpine Linux is much smaller than most distribution base images, and thus leads to slimmer and more secure images.
The Alpine variant is highly recommended when security is important and you want an  image size that’s as small as possible. Note that the Alpine variant uses [musl libc](http://www.musl-libc.org/) instead of [glibc and friends](http://www.etalabs.net/compare_libcs.html), so certain software might run into issues depending on the depth of their libc requirements. However, most software doesn’t have an issue with this, so this variant is usually a very safe choice.

## Ubuntu image

**Grafana Enterprise**: `grafana/grafana-enterprise:<version>-ubuntu`

**Grafana Open Source**: `grafana/grafana-oss:<version>-ubuntu`

These images are based on [Ubuntu](https://ubuntu.com/), available in the [Ubuntu official image](https://hub.docker.com/_/ubuntu). It is an alternative image for those who prefer an Ubuntu-based image and/or are dependent on certain tooling not available for Alpine.

## Run a specific version of Grafana

You can also run a specific version, or run a beta version based on the main branch of the [grafana/grafana GitHub repository](https://github.com/grafana/grafana).

> **Note:** If you are on a Linux system (e.g. Debian, Ubuntu), you might need to add `sudo` before the command or add your user to the `docker` group by following the official documentation to [run Docker without a non-root user](https://docs.docker.com/engine/install/linux-postinstall/).


To run a specific version of Grafana mention it in the command <version number> section:

```bash
docker run -d -p 3000:3000 --name grafana grafana/grafana-enterprise:<version number>
```

Example:

This command will run Grafana Enterprise container which has version 9.4.7. If you want to run a different version e.g. 9.4.3 then just put it in the version-number section

```bash
docker run -d -p 3000:3000 --name grafana grafana/grafana-enterprise:9.4.7
```

## Run the Grafana main branch

For every successful build of the main branch, we update the `grafana/grafana-oss:main` and `grafana/grafana-oss:main-ubuntu` tags. Additionally, two new tags are created, `grafana/grafana-oss-dev:<version>-<build ID>pre` and `grafana/grafana-oss-dev:<version>-<build ID>pre-ubuntu`, where version is the next version of Grafana and build ID is the ID of the corresponding CI build. You can use these Tags to get access to the latest main builds of Grafana.
When running Grafana main in production, we strongly recommend that you use the `grafana/grafana-oss-dev:<version>-<build ID>pre` tag. This tag guarantees that you use a specific version of Grafana instead of the most recent commit.
For a list of available tags, refer to [grafana/grafana-oss](https://hub.docker.com/r/grafana/grafana-oss/tags/) and [grafana/grafana-oss-dev](https://hub.docker.com/r/grafana/grafana-oss-dev/tags/).

# Default paths

When starting the Grafana Docker container, the following configurations are set by default and cannot be changed by editing the `conf/grafana.ini` file. Instead, you can only modify these configurations using [environment variables]({{< relref "./configure-grafana/#override-configuration-with-environment-variables" >}}).

| Setting               | Default value             |
| --------------------- | ------------------------- |
| GF_PATHS_CONFIG       | /etc/grafana/grafana.ini  |
| GF_PATHS_DATA         | /var/lib/grafana          |
| GF_PATHS_HOME         | /usr/share/grafana        |
| GF_PATHS_LOGS         | /var/log/grafana          |
| GF_PATHS_PLUGINS      | /var/lib/grafana/plugins  |
| GF_PATHS_PROVISIONING | /etc/grafana/provisioning |

# Install plugins in the Docker container

You can install publicly available plugins and also plugins that are private or used internally in an organization.

## Install plugins from other sources

To install plugins from other sources, you must define the custom URL and specify it in an environment variable: `GF_INSTALL_PLUGINS=<url to plugin zip>;<plugin install folder name>`.

Example:

The following command runs Grafana Enterprise on **port 3000** in detached mode and installs the custom plugin, which is specified as a URL parameter in the `GF_INSTALL_PLUGIN` environment variable.

```bash
docker run -d \
  -p 3000:3000 \
  --name=grafana \
  -e "GF_INSTALL_PLUGINS=http://plugin-domain.com/my-custom-plugin.zip;custom-plugin,grafana-clock-panel" \
  grafana/grafana-enterprise
```

# Build and run a Docker image with pre-installed plugins

You can build your own customized image that includes plugins. This saves time if you are creating multiple images and you want them all to have the same plugins installed on the build.


In the Grafana GitHub repository, the `packaging/docker/custom/` folder includes a `Dockerfile` that you can use to build a custom Grafana image. The `Dockerfile` accepts `GRAFANA_VERSION`, `GF_INSTALL_PLUGINS`, and `GF_INSTALL_IMAGE_RENDERER_PLUGIN` as build arguments.

The `GRAFANA_VERSION` build argument must be a valid `grafana/grafana` Docker image tag. By default, Grafana builds an Alpine-based image. To build an Ubuntu-based image, append `-ubuntu` to the `GRAFANA_VERSION` build argument.

Example:

The following example shows you how to build and run a custom Grafana Docker image based on the latest official Ubuntu-based Grafana Docker image:

```bash
# go to the custom directory
cd packaging/docker/custom

# run the docker build command to build the image
docker build \
  --build-arg "GRAFANA_VERSION=latest-ubuntu" \
  -t grafana-custom .

# run the custom grafana container using docker run command
docker run -d -p 3000:3000 --name=grafana grafana-custom
```
## Build with pre-installed plugins

You can build the Grafana custom image by including plugins which are available on the [Grafana Plugin download page](https://grafana.com/grafana/plugins). By this, you will not need to install plugins manually which can save time.

> **Note:**  If you need to specify the version of a plugin, you can add it to the `GF_INSTALL_PLUGINS` build an argument. Otherwise, the latest will be assumed for e.g. `--build-arg "GF_INSTALL_PLUGINS=grafana-clock-panel 1.0.1,grafana-simple-json-datasource 1.3.5"`

Example:

The following explains as how to build a custom Grafana image and run it with plugins as pre-installed

```bash
# go to the custom directory
cd packaging/docker/custom

# running the build command
# include the plugins you want e.g. clock planel etc
docker build \
  --build-arg "GRAFANA_VERSION=latest" \
  --build-arg "GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource" \
  -t grafana-custom .

# running the custom Grafana container using the docker run command
docker run -d -p 3000:3000 --name=grafana grafana-custom
```

## Build with pre-installed plugins from other sources

You can build a Docker image with plugins from other sources if they are not publicly available (e.g. a private plugin used only within an organization) by specifying the URL like this: `GF_INSTALL_PLUGINS=<url to plugin zip>;<plugin install folder name>`.

Example:


The following example demonstrates creating a customized Grafana Docker image that includes the clock panel and simple-json-datasource plugins. You can define these plugins in the build argument using the Grafana Plugin environment variable

```bash
#go to the folder
cd packaging/docker/custom

#running the build command
docker build \
--build-arg "GRAFANA_VERSION=latest" \
--build-arg "GF_INSTALL_PLUGINS=grafana-clock-panel, grafana-simple-json-datasource" \
-t grafana-custom .

# running the docker run command
docker run -d -p 3000:3000 --name=grafana grafana-custom
```

## Build Grafana with the Image Renderer plugin pre-installed

> **Note:**  This feature is experimental.

The Grafana Image Renderer plugin does not currently work (see [GitHub Issue#301](https://github.com/grafana/grafana-image-renderer/issues/301)) if it is installed in a Grafana Docker image. You can build a custom Docker image using the `GF_INSTALL_IMAGE_RENDERER_PLUGIN` build argument. This installs additional dependencies needed for the Grafana Image Renderer plugin to run.

Example:

The following example shows how to build a customized Grafana Docker image that includes the Image Renderer plugin.

```bash
#go to the folder
cd packaging/docker/custom

#running the build command
docker build \
--build-arg "GRAFANA_VERSION=latest" \
--build-arg "GF_INSTALL_IMAGE_RENDERER_PLUGIN=true" \
-t grafana-custom .

# running the docker run command
docker run -d -p 3000:3000 --name=grafana grafana-custom
```

# Logging

Logs in the Docker container go to `STDOUT` by default, as is common in the Docker world. Change this by setting a different [log mode](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#mode). Available options are `console`, `file`, and `syslog`. The default is `console` and `file`. Use spaces to separate multiple modes, e.g `console file`

Example:

To change the log mode, use the `GF_LOG_MODE` environment variable and define your mode e.g. to use `console file`, run the command:

```bash
# Run Grafana while logging to both standard out 
# and /var/log/grafana/grafana.log

docker run -p 3000:3000 -e "GF_LOG_MODE=console file" grafana/grafana-enterprise
```
# Configure Grafana with Docker Secrets

You can supply Grafana sensitive information e.g. secrets, login credentials etc. with configuration through files. This works well with [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/) as the secrets by default are mapped into the following location in the container: `/run/secrets/<name of secret>.
` 
You can do this with any of the configuration options in `conf/grafana.ini` by setting `GF_<SectionName>_<KeyName>__FILE` to the path of the file holding the secret.

For example, you could set the admin password this way:

- Admin password secret: `/run/secrets/admin_password`
- Environment variable: `GF_SECURITY_ADMIN_PASSWORD__FILE=/run/secrets/admin_password`
# Configure AWS credentials for CloudWatch Support

Defining secrets is very important on the public cloud so that it is not visible as plain text and provide a layer of security.

```bash
docker run -d \
-p 3000:3000 \
--name=grafana \
-e "GF_AWS_PROFILES=default" \
-e "GF_AWS_default_ACCESS_KEY_ID=YOUR_ACCESS_KEY" \
-e "GF_AWS_default_SECRET_ACCESS_KEY=YOUR_SECRET_KEY" \
-e "GF_AWS_default_REGION=us-east-1" \
grafana/grafana-enterprise
```
You may also specify multiple profiles to `GF_AWS_PROFILES` (e.g. `GF_AWS_PROFILES=default another`).

Supported variables:

- `GF_AWS_${profile}_ACCESS_KEY_ID`: AWS access key ID (required).
- `GF_AWS_${profile}_SECRET_ACCESS_KEY`: AWS secret access key (required).
- `GF_AWS_${profile}_REGION`: AWS region (optional).

# Troubleshooting

For troubleshooting, we recommend increasing the log level to `DEBUG` mode. For more information, refer to the [log section in Configuration](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#log).

## Increasing the default log level

By default, the Grafana log level is in `INFO` mode but offers other levels which are helpful when trying to reproduce a problem.

### Increasing log level while using the Docker run (CLI) command

To increase the log level to e.g. `DEBUG` mode, you need to use the Environment variable, `GF_LOG_LEVEL` on the command line:

```bash
docker run -d -p 3000:3000 --name=grafana \
-e "GF_LOG_LEVEL=DEBUG" \
grafana/grafana-enterprise
```

### Increasing log level while using the Docker Compose

To increase the log level to e.g. `DEBUG` mode, you need to use the Environment variable, `GF_LOG_LEVEL` as explained below inside the `docker-compose.yaml` file.

```yaml
version: "3.8"
services:
  grafana:
    image: grafana/grafana-enterprise
    container_name: grafana
    restart: unless-stopped
    environment:
      # increases the log level from info to debug
      - GF_LOG_LEVEL=debug
    ports:
      - '3000:3000'
    volumes:
      - 'grafana_storage:/var/lib/grafana'
volumes:
  grafana_storage: {}
```

## Validating Docker Compose YAML file

Sometimes there are syntax error in the `docker-compose.yaml` file once it gets complicated. Use the docker built-in command `docker compose config` to check for any syntax errors.

Example

To check for any syntax error run the command:

```bash
docker compose config docker-compose.yaml
```

If there are any errors, it will inform you with the line numbers. Else it will output the content of the `docker-compose.yaml` file in detailed YAML format.