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
title: Configure a Grafana Docker image
menuTitle: Configure a Docker image
weight: 1800
---

# Configure a Grafana Docker image

This topic explains how to run Grafana on Docker in complex environments that require you to: 
- Use different images
- Change logging levels
- Define secrets on the Cloud
- Configure plugins

> **Note:** The examples in this topic use the Grafana Enterprise Docker image. You can use the Grafana Open Source edition by changing the Docker image to `grafana/grafana-oss`.

# Supported Docker image variants

You can install and run Grafana using the following official Docker images.

- **Grafana Enterprise**: `grafana/grafana-enterprise`

- **Grafana Open Source**: `grafana/grafana-oss`

Each edition is available in two variants: Alpine and Ubuntu.

## Alpine image (recommended)

[Alpine Linux](https://alpinelinux.org/about/) is a Linux distribution not affiliated with any commercial entity. It is a versatile operating system that caters to users who prioritize security, efficiency, and user-friendliness. Alpine Linux is much smaller than other distribution base images, allowing for slimmer and more secure images to be created.

By default, the images are built using the widely-used [Alpine Linux project](http://alpinelinux.org/) and can be accessed through the [Alpine official image](https://hub.docker.com/_/alpine).
If you prioritize security and want to minimize the size of your image, it is recommended that you use the Alpine variant. However, it's important to note that the Alpine variant uses [musl libc](http://www.musl-libc.org/) instead of [glibc and others](http://www.etalabs.net/compare_libcs.html). As a result, some software might encounter problems depending on their libc requirements. Nonetheless, most software should not experience any issues, so the Alpine variant is generally reliable.

## Ubuntu image

- **Grafana Enterprise**: `grafana/grafana-enterprise:<version>-ubuntu`

- **Grafana Open Source**: `grafana/grafana-oss:<version>-ubuntu`

The Grafana Enterprise and OSS images are based on [Ubuntu](https://ubuntu.com/) and can be accessed through the [Ubuntu official image](https://hub.docker.com/_/ubuntu). This is a good option for users who prefer an Ubuntu-based image or require specific tools unavailable on Alpine.

## Run a specific version of Grafana

You can also run a specific version of Grafana or a beta version based on the main branch of the [grafana/grafana GitHub repository](https://github.com/grafana/grafana).

> **Note:** If you use a Linux operating system such as Debian or Ubuntu and encounter permission errors when running Docker commands, you might need to prefix the command with `sudo` or add your user to the `docker` group. The official Docker documentation provides instructions on how to [run Docker without a non-root user](https://docs.docker.com/engine/install/linux-postinstall/).




To run a specific version of Grafana, add it in the command <version number> section:

```bash
docker run -d -p 3000:3000 --name grafana grafana/grafana-enterprise:<version number>
```

Example:

The following command runs the Grafana Enterprise container, which has version 9.4.7. If you want to run a different version, modify the version number section.

```bash
docker run -d -p 3000:3000 --name grafana grafana/grafana-enterprise:9.4.7
```

## Run the Grafana main branch

For every successful build of the main branch, we update the `grafana/grafana-oss:main` and `grafana/grafana-oss:main-ubuntu` tags. Additionally, two new tags are created, `grafana/grafana-oss-dev:<version>-<build ID>pre` and `grafana/grafana-oss-dev:<version>-<build ID>pre-ubuntu`, where version is the next version of Grafana and build ID is the ID of the corresponding CI build. You can use these Tags to get access to the latest main builds of Grafana.
When running Grafana main in production, we strongly recommend that you use the `grafana/grafana-oss-dev:<version>-<build ID>pre` tag. This tag guarantees that you use a specific version of Grafana instead of the most recent commit.
For a list of available tags, refer to [grafana/grafana-oss](https://hub.docker.com/r/grafana/grafana-oss/tags/) and [grafana/grafana-oss-dev](https://hub.docker.com/r/grafana/grafana-oss-dev/tags/).

## Default paths

Grafana comes with default configuration parameters that remain the same among versions regardless of the operating system or the environment (for example, virtual machine, Docker, Kubernetes, etc.). You can refer to the [Configure Grafana](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana) documentation to view all the default configuraiton settings.

The following configurations are set by default when you start the Grafana Docker container. You cannot change the configurations by editing the `conf/grafana.ini` file. Instead, you can only modify these configurations using [environment variables]({{< relref "./configure-grafana/#override-configuration-with-environment-variables" >}}).

| Setting               | Default value             |
| --------------------- | ------------------------- |
| GF_PATHS_CONFIG       | /etc/grafana/grafana.ini  |
| GF_PATHS_DATA         | /var/lib/grafana          |
| GF_PATHS_HOME         | /usr/share/grafana        |
| GF_PATHS_LOGS         | /var/log/grafana          |
| GF_PATHS_PLUGINS      | /var/lib/grafana/plugins  |
| GF_PATHS_PROVISIONING | /etc/grafana/provisioning |

## Install plugins in the Docker container

You can install publicly available plugins and plugins that are private or used internally in an organization.

### Install plugins from other sources

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

## Build and run a Docker image with pre-installed plugins

To create multiple images with the same plugins, you can save time by building your own customized image that includes those plugins.


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
## Build a Grafana Docker image with pre-installed plugins

To save time, you can customize a Grafana image by including plugins available on the [Grafana Plugin download page](https://grafana.com/grafana/plugins). By doing so, you won't have to manually install the plugins each time, making the process more efficient.

> **Note:** To specify the version of a plugin, you can use the `GF_INSTALL_PLUGINS` build argument and add the version number. The latest version is used if you don't specify a version number. For example, you can use `--build-arg "GF_INSTALL_PLUGINS=grafana-clock-panel 1.0.1,grafana-simple-json-datasource 1.3.5"` to specify the versions of two plugins.

Example:

The following example shows how to build and run a custom Grafana image with pre-installed plugins.

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

## Build a Grafana Docker image with pre-installed plugins from other sources

You can create a Docker image containing a plugin that is exclusive to your organization, even if it is not accessible to the public. Simply use the `GF_INSTALL_PLUGINS` build argument to specify the plugin's URL and installation folder name, such as `GF_INSTALL_PLUGINS=;`.

The following example demonstrates creating a customized Grafana Docker image that includes the clock panel and simple-json-datasource plugins. You can define these plugins in the build argument using the Grafana Plugin environment variable.

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

Currently, the Grafana Image Renderer plugin is not functional (as stated in [GitHub Issue#301](https://github.com/grafana/grafana-image-renderer/issues/301)) when installed in a Grafana Docker image. However, you can create a customized Docker image utilizing the `GF_INSTALL_IMAGE_RENDERER_PLUGIN` build argument as a solution. This will install the necessary dependencies for the Grafana Image Renderer plugin to run.

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

## Logging

By default, Docker container logs are directed to `STDOUT`, a common practice in the Docker community. You can change this by setting a different [log mode]({{< relref "../../../configure-grafana/#mode" >}}) such as `console`, `file`, or `syslog`. You can use one or more modes by separating them with spaces, for example, `console file`. By default, both `console` and `file` modes are enabled.

Example:

The following example runs Grafana using the `console file` log mode that is set in the `GF_LOG_MODE` environment variable.

```bash
# Run Grafana while logging to both standard out 
# and /var/log/grafana/grafana.log

docker run -p 3000:3000 -e "GF_LOG_MODE=console file" grafana/grafana-enterprise
```
# Configure Grafana with Docker Secrets

Using configuration files, you can input confidential data like login credentials and secrets into Grafana. This method works well with Docker Secrets, as the secrets are automatically mapped to the `/run/secrets/` location within the container. 

You can apply this technique to any configuration options in `conf/grafana.ini` by setting `GF_<SectionName>_<KeyName>__FILE` to the file path that contains the secret information.

The following example demonstrates how to set the admin password:

- Admin password secret: `/run/secrets/admin_password`
- Environment variable: `GF_SECURITY_ADMIN_PASSWORD__FILE=/run/secrets/admin_password`

## Configure Docker secrets credentials for AWS CloudWatch

Grafana ships with built-in support for [Amazon CloudWatch datasource](https://grafana.com/docs/grafana/latest/datasources/aws-cloudwatch/), where need to provide information such as AWS ID-Key, secret access key, region etc. For which you can use the Docker secrets to achieve it.

Example:

The following example defines Docker Secrets for an AWS ID-Key, secret access key, region, and profile.

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
You can also specify multiple profiles to `GF_AWS_PROFILES` (for example, `GF_AWS_PROFILES=default another`).

Supported variables:

- `GF_AWS_${profile}_ACCESS_KEY_ID`: AWS access key ID (required).
- `GF_AWS_${profile}_SECRET_ACCESS_KEY`: AWS secret access key (required).
- `GF_AWS_${profile}_REGION`: AWS region (optional).

## Troubleshooting

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