---
aliases:
  - ../../installation/docker/
description: Guide for running Grafana using Docker
labels:
  products:
    - enterprise
    - oss
menuTitle: Grafana Docker image
title: Run Grafana Docker image
weight: 400
---

# Run Grafana Docker image

This topic guides you through installing Grafana via the official Docker images. Specifically, it covers running Grafana via the Docker command line interface (CLI) and docker-compose.

{{< youtube id="FlDfcMbSLXs" start="703">}}

Grafana Docker images come in two editions:

- **Grafana Enterprise**: `grafana/grafana-enterprise`
- **Grafana Open Source**: `grafana/grafana-oss`

> **Note:** The recommended and default edition of Grafana is Grafana Enterprise. It is free and includes all the features of the OSS edition. Additionally, you have the option to upgrade to the [full Enterprise feature set](/products/enterprise/?utm_source=grafana-install-page), which includes support for [Enterprise plugins](/grafana/plugins/?enterprise=1&utcm_source=grafana-install-page).

The default images for Grafana are created using the Alpine Linux project and can be found in the Alpine official image. For instructions on configuring a Docker image for Grafana, refer to [Configure a Grafana Docker image](../../configure-docker/).

## Run Grafana via Docker CLI

This section shows you how to run Grafana using the Docker CLI.

> **Note:** If you are on a Linux system (for example, Debian or Ubuntu), you might need to add `sudo` before the command or add your user to the `docker` group. For more information, refer to [Linux post-installation steps for Docker Engine](https://docs.docker.com/engine/install/linux-postinstall/).

To run the latest stable version of Grafana, run the following command:

```bash
docker run -d -p 3000:3000 --name=grafana grafana/grafana-enterprise
```

Where:

- [`docker run`](https://docs.docker.com/engine/reference/commandline/run/) is a Docker CLI command that runs a new container from an image
- `-d` (`--detach`) runs the container in the background
- `-p <host-port>:<container-port>` (`--publish`) publish a container's port(s) to the host, allowing you to reach the container's port via a host port. In this case, we can reach the container's port `3000` via the host's port `3000`
- `--name` assign a logical name to the container (e.g. `grafana`). This allows you to refer to the container by name instead of by ID.
- `grafana/grafana-enterprise` is the image to run

### Stop the Grafana container

To stop the Grafana container, run the following command:

```bash
# The `docker ps` command shows the processes running in Docker
docker ps

# This will display a list of containers that looks like the following:
CONTAINER ID   IMAGE  COMMAND   CREATED  STATUS   PORTS    NAMES
cd48d3994968   grafana/grafana-enterprise   "/run.sh"   8 seconds ago   Up 7 seconds   0.0.0.0:3000->3000/tcp   grafana

# To stop the grafana container run the command
# docker stop CONTAINER-ID or use
# docker stop NAME, which is `grafana` as previously defined
docker stop grafana
```

### Save your Grafana data

By default, Grafana uses an embedded SQLite version 3 database to store configuration, users, dashboards, and other data. When you run Docker images as containers, changes to these Grafana data are written to the filesystem within the container, which will only persist for as long as the container exists. If you stop and remove the container, any filesystem changes (i.e. the Grafana data) will be discarded. To avoid losing your data, you can set up persistent storage using [Docker volumes](https://docs.docker.com/storage/volumes/) or [bind mounts](https://docs.docker.com/storage/bind-mounts/) for your container.

> **Note:** Though both methods are similar, there is a slight difference. If you want your storage to be fully managed by Docker and accessed only through Docker containers and the Docker CLI, you should choose to use persistent storage. However, if you need full control of the storage and want to allow other processes besides Docker to access or modify the storage layer, then bind mounts is the right choice for your environment.

#### Use Docker volumes (recommended)

Use Docker volumes when you want the Docker Engine to manage the storage volume.

To use Docker volumes for persistent storage, complete the following steps:

1. Create a Docker volume to be used by the Grafana container, giving it a descriptive name (e.g. `grafana-storage`). Run the following command:

   ```bash
   # create a persistent volume for your data
   docker volume create grafana-storage

   # verify that the volume was created correctly
   # you should see some JSON output
   docker volume inspect grafana-storage
   ```

1. Start the Grafana container by running the following command:
   ```bash
   # start grafana
   docker run -d -p 3000:3000 --name=grafana \
     --volume grafana-storage:/var/lib/grafana \
     grafana/grafana-enterprise
   ```

#### Use bind mounts

If you plan to use directories on your host for the database or configuration when running Grafana in Docker, you must start the container with a user with permission to access and write to the directory you map.

To use bind mounts, run the following command:

```bash
# create a directory for your data
mkdir data

# start grafana with your user id and using the data directory
docker run -d -p 3000:3000 --name=grafana \
  --user "$(id -u)" \
  --volume "$PWD/data:/var/lib/grafana" \
  grafana/grafana-enterprise
```

### Use environment variables to configure Grafana

Grafana supports specifying custom configuration settings using [environment variables](../../configure-grafana/#override-configuration-with-environment-variables).

```bash
# enable debug logs

docker run -d -p 3000:3000 --name=grafana \
  -e "GF_LOG_LEVEL=debug" \
  grafana/grafana-enterprise
```

## Install plugins in the Docker container

You can install plugins in Grafana from the official and community [plugins page](/grafana/plugins) or by using a custom URL to install a private plugin. These plugins allow you to add new visualization types, data sources, and applications to help you better visualize your data.

Grafana currently supports three types of plugins: panel, data source, and app. For more information on managing plugins, refer to [Plugin Management](../../../administration/plugin-management/).

To install plugins in the Docker container, complete the following steps:

1. Pass the plugins you want to be installed to Docker with the `GF_PLUGINS_PREINSTALL` environment variable as a comma-separated list.

   This starts a background process that installs the list of plugins while Grafana server starts.

   For example:

   ```bash
   docker run -d -p 3000:3000 --name=grafana \
     -e "GF_PLUGINS_PREINSTALL=grafana-clock-panel, grafana-simple-json-datasource" \
     grafana/grafana-enterprise
   ```

1. To specify the version of a plugin, add the version number to the `GF_PLUGINS_PREINSTALL` environment variable.

   For example:

   ```bash
   docker run -d -p 3000:3000 --name=grafana \
     -e "GF_PLUGINS_PREINSTALL=grafana-clock-panel@1.0.1" \
     grafana/grafana-enterprise
   ```

   > **Note:** If you do not specify a version number, the latest version is used.

1. To install a plugin from a custom URL, use the following convention to specify the URL: `<plugin ID>@[<plugin version>]@<url to plugin zip>`.

   For example:

   ```bash
   docker run -d -p 3000:3000 --name=grafana \
     -e "GF_PLUGINS_PREINSTALL=custom-plugin@@https://github.com/VolkovLabs/custom-plugin.zip" \
     grafana/grafana-enterprise
   ```

## Example

The following example runs the latest stable version of Grafana, listening on port 3000, with the container named `grafana`, persistent storage in the `grafana-storage` docker volume, the server root URL set, and the official [clock panel](/grafana/plugins/grafana-clock-panel) plugin installed.

```bash
# create a persistent volume for your data
docker volume create grafana-storage

# start grafana by using the above persistent storage
# and defining environment variables

docker run -d -p 3000:3000 --name=grafana \
  --volume grafana-storage:/var/lib/grafana \
  -e "GF_SERVER_ROOT_URL=http://my.grafana.server/" \
  -e "GF_PLUGINS_PREINSTALL=grafana-clock-panel" \
  grafana/grafana-enterprise
```

## Run Grafana via Docker Compose

Docker Compose is a software tool that makes it easy to define and share applications that consist of multiple containers. It works by using a YAML file, usually called `docker-compose.yaml`, which lists all the services that make up the application. You can start the containers in the correct order with a single command, and with another command, you can shut them down. For more information about the benefits of using Docker Compose and how to use it refer to [Use Docker Compose](https://docs.docker.com/get-started/08_using_compose/).

### Before you begin

To run Grafana via Docker Compose, install the compose tool on your machine. To determine if the compose tool is available, run the following command:

```bash
docker compose version
```

If the compose tool is unavailable, refer to [Install Docker Compose](https://docs.docker.com/compose/install/).

### Run the latest stable version of Grafana

This section shows you how to run Grafana using Docker Compose. The examples in this section use Compose version 3. For more information about compatibility, refer to [Compose and Docker compatibility matrix](https://docs.docker.com/compose/compose-file/compose-file-v3/).

> **Note:** If you are on a Linux system (for example, Debian or Ubuntu), you might need to add `sudo` before the command or add your user to the `docker` group. For more information, refer to [Linux post-installation steps for Docker Engine](https://docs.docker.com/engine/install/linux-postinstall/).

To run the latest stable version of Grafana using Docker Compose, complete the following steps:

1. Create a `docker-compose.yaml` file.

   ```bash
   # first go into the directory where you have created this docker-compose.yaml file
   cd /path/to/docker-compose-directory

   # now create the docker-compose.yaml file
   touch docker-compose.yaml
   ```

1. Now, add the following code into the `docker-compose.yaml` file.

   For example:

   ```yaml
   services:
     grafana:
       image: grafana/grafana-enterprise
       container_name: grafana
       restart: unless-stopped
       ports:
         - '3000:3000'
   ```

1. To run `docker-compose.yaml`, run the following command:

   ```bash
   # start the grafana container
   docker compose up -d
   ```

   Where:

   d = detached mode

   up = to bring the container up and running

To determine that Grafana is running, open a browser window and type `IP_ADDRESS:3000`. The sign in screen should appear.

### Stop the Grafana container

To stop the Grafana container, run the following command:

```bash
docker compose down
```

> **Note:** For more information about using Docker Compose commands, refer to [docker compose](https://docs.docker.com/engine/reference/commandline/compose/).

### Save your Grafana data

By default, Grafana uses an embedded SQLite version 3 database to store configuration, users, dashboards, and other data. When you run Docker images as containers, changes to these Grafana data are written to the filesystem within the container, which will only persist for as long as the container exists. If you stop and remove the container, any filesystem changes (i.e. the Grafana data) will be discarded. To avoid losing your data, you can set up persistent storage using [Docker volumes](https://docs.docker.com/storage/volumes/) or [bind mounts](https://docs.docker.com/storage/bind-mounts/) for your container.

#### Use Docker volumes (recommended)

Use Docker volumes when you want the Docker Engine to manage the storage volume.

To use Docker volumes for persistent storage, complete the following steps:

1. Create a `docker-compose.yaml` file

   ```bash
   # first go into the directory where you have created this docker-compose.yaml file
   cd /path/to/docker-compose-directory

   # now create the docker-compose.yaml file
   touch docker-compose.yaml
   ```

1. Add the following code into the `docker-compose.yaml` file.

   ```yaml
   services:
     grafana:
       image: grafana/grafana-enterprise
       container_name: grafana
       restart: unless-stopped
       ports:
         - '3000:3000'
       volumes:
         - grafana-storage:/var/lib/grafana
   volumes:
     grafana-storage: {}
   ```

1. Save the file and run the following command:

   ```bash
   docker compose up -d
   ```

#### Use bind mounts

If you plan to use directories on your host for the database or configuration when running Grafana in Docker, you must start the container with a user that has the permission to access and write to the directory you map.

To use bind mounts, complete the following steps:

1. Create a `docker-compose.yaml` file

   ```bash
   # first go into the directory where you have created this docker-compose.yaml file
   cd /path/to/docker-compose-directory

   # now create the docker-compose.yaml file
   touch docker-compose.yaml
   ```

1. Create the directory where you will be mounting your data, in this case is `/data` e.g. in your current working directory:

   ```bash
   mkdir $PWD/data
   ```

1. Now, add the following code into the `docker-compose.yaml` file.

   ```yaml
   services:
     grafana:
       image: grafana/grafana-enterprise
       container_name: grafana
       restart: unless-stopped
       # if you are running as root then set it to 0
       # else find the right id with the id -u command
       user: '0'
       ports:
         - '3000:3000'
       # adding the mount volume point which we create earlier
       volumes:
         - '$PWD/data:/var/lib/grafana'
   ```

1. Save the file and run the following command:

   ```bash
   docker compose up -d
   ```

### Example

The following example runs the latest stable version of Grafana, listening on port 3000, with the container named `grafana`, persistent storage in the `grafana-storage` docker volume, the server root URL set, and the official [clock panel](/grafana/plugins/grafana-clock-panel/) plugin installed.

```yaml
services:
  grafana:
    image: grafana/grafana-enterprise
    container_name: grafana
    restart: unless-stopped
    environment:
      - GF_SERVER_ROOT_URL=http://my.grafana.server/
      - GF_PLUGINS_PREINSTALL=grafana-clock-panel
    ports:
      - '3000:3000'
    volumes:
      - 'grafana_storage:/var/lib/grafana'
volumes:
  grafana_storage: {}
```

{{< admonition type="note" >}}
If you want to specify the version of a plugin, add the version number to the `GF_PLUGINS_PREINSTALL` environment variable. For example: `-e "GF_PLUGINS_PREINSTALL=grafana-clock-panel@1.0.1,grafana-simple-json-datasource@1.3.5"`. If you do not specify a version number, the latest version is used.
{{< /admonition >}}

## Next steps

Refer to the [Getting Started](../../../getting-started/build-first-dashboard/) guide for information about logging in, setting up data sources, and so on.

## Configure Docker image

Refer to [Configure a Grafana Docker image](../../configure-docker/) page for details on options for customizing your environment, logging, database, and so on.

## Configure Grafana

Refer to the [Configuration](../../configure-grafana/) page for details on options for customizing your environment, logging, database, and so on.
