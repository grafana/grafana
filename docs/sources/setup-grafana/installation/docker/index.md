---
aliases:
  - ../../installation/docker/
description: Guide for running Grafana using Docker
title: Run Grafana Docker image
weight: 200
---

# Run Grafana Docker image

This topic guides you on how to install Grafana by utilizing the official Docker images. Specifically, it covers running Grafana via the Docker command line (CLI) and docker-compose.

Grafana Docker images come in two editions:
- **Grafana Enterprise**: `grafana/grafana-enterprise`
- **Grafana Open Source**: `grafana/grafana-oss`

> **Note:** The recommended and default edition of Grafana is Grafana Enterprise. It is free and includes all the features of the OSS edition. Additionally, you have the option to upgrade to the [full Enterprise feature set](/products/enterprise/?utm_source=grafana-install-page), which includes support for [Enterprise plugins](/grafana/plugins/?enterprise=1&utcm_source=grafana-install-page).

The default images for Grafana are created using the Alpine Linux project and can be found in the Alpine official image. For instructions on configuring a Docker image for Grafana, refer to [Configure a Grafana Docker image]({{< ref "../../configure-docker/" >}}).

## Run Grafana via Docker CLI

This section shows you how to run Grafana using the Docker CLI. 

> **Note:** If you are on a Linux system (for example, Debian or Ubuntu), you might need to add `sudo` before the command or add your user to the `docker` group. For more information, refer to [Linux post-installation steps for Docker Engine](https://docs.docker.com/engine/install/linux-postinstall/).

To run the latest stable version of Grafana, run the following command:

```bash
docker run -d -p 3000:3000 --name=grafana grafana/grafana-enterprise
```

where:

run = run directly from the command line\
d = run in the background\
p = assign the port number, which in this case is `3000`\
name = assign a logical name to the container, for example, `grafana`\
grafana/grafana-enterprise = the image to run in the container

### Stop the Grafana container

To stop the Grafana container, run the following command:

```bash
# docker ps command tells about the running process in the docker
docker ps

# This will display a list of containers, like:
CONTAINER ID   IMAGE  COMMAND   CREATED  STATUS   PORTS    NAMES
cd48d3994968   grafana/grafana-enterprise   "/run.sh"   8 seconds ago   Up 7 seconds   0.0.0.0:3000->3000/tcp   grafana

# To stop the grafana container run the command
# docker stop CONTAINER-ID or use 
# docker stop NAME (which is grafana as we defined previously)
docker stop grafana
```

### Save your Grafana data

When you use Docker containers, the data inside them is temporary by default. This means that if you don't specify where to store the information, all the Grafana data will be lost when you stop the Docker container. To avoid losing your data, you can set up [persistent storage](https://docs.docker.com/storage/volumes/) or [bind mounts](https://docs.docker.com/storage/bind-mounts/) for your container.

#### Use persistent storage (recommended)

To use persistent storage, complete the following steps:

1. Ceate a Docker volume by running the following command:

   ```bash
   # create a persistent volume for your data
   docker volume create grafana-storage

   # verify that the volume was created correctly
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

If you plan to use folders on your host for the database or configuration when running Grafana in Docker, you must start the container with a user that has the permission to access and write to the folder you map.

To use bind mounts, run the following command:

```bash
# create a folder for your data
mkdir data

# start grafana with your user id and using the data folder
docker run -d -p 3000:3000 --name=grafana \
--user "$(id -u)" --volume "$PWD/data:/var/lib/grafana" \
grafana/grafana-enterprise
```

#### Use environment variables

Grafana supports specifying custom configuration settings via [environment variables](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#override-configuration-with-environment-variables) within your Docker container.

```bash
# enabling public dashboard feature

docker run -d -p 3000:3000 --name=grafana \
-e "GF_FEATURE_TOGGLES_ENABLE=publicDashboards" \
grafana/grafana-enterprise
```

## Install plugins in the Docker container

You can install plugins in Grafana from the official and community [plugins page](https://grafana.com/grafana/plugins) or by using a custom URL to install a private plugin. These plugins allow you to add new visualization types, data sources, and applications to help you better visualize your data.

Grafana currently supports three types of plugins: panel, data source, and app. For more information on managing plugins, refer to [Plugin Management]({{< relref "../../../administration/plugin-management/" >}}).

To install plugins in the Docket container, complete the following steps:

1. Pass the plugins you want to be installed to Docker with the `GF_INSTALL_PLUGINS` environment variable as a comma-separated list. 

   This sends each plugin name to `grafana-cli plugins install ${plugin}` and installs them when Grafana starts.

   For example:

   ```bash
   docker run -d -p 3000:3000 --name=grafana \
   -e "GF_INSTALL_PLUGINS=grafana-clock-panel grafana-simple-json-datasource" grafana/grafana-enterprise
   ```

1. To specify the version of a plugin, add the version number to the `GF_INSTALL_PLUGINS` environment variable. 

   For example:

   ```bash
   docker run -d -p 3000:3000 --name=grafana \
   -e "GF_INSTALL_PLUGINS=grafana-clock-panel 1.0.1" \
   grafana/grafana-enterprise
   ```

   >**Note:** If you do not specify a version number, the latest version is used.

1. To install a plugin from a custom URL, use the following convention to specify the URL: `<url to plugin zip>;<plugin install folder name>`.

   For example: 

   ```bash
   docker run -d -p 3000:3000 --name=grafana \
   -e "GF_INSTALL_PLUGINS=https://github.com/VolkovLabs/custom-plugin.zip;custom-plugin" \
   grafana/grafana-enterprise
   ```

## Example

The following example runs the latest stable version of Grafana, listening on port 3000, with the container named "grafana", persistent storage in the grafana-storage docker volume, the server root URL set, and the official [clock panel](https://grafana.com/grafana/plugins/grafana-clock-panel/) plugin installed.

```bash
# create a persistent volume for your data
docker volume create grafana-storage

# start grafana by using the above persistent storage
# and defining Environment Variables

docker run -d -p 3000:3000 --name=grafana \
--volume grafana-storage:/var/lib/grafana \
-e "GF_SERVER_ROOT_URL=http://my.grafana.server/" \
-e "GF_INSTALL_PLUGINS=grafana-clock-panel" \
grafana/grafana-enterprise
```

## Run Grafana via Docker Compose

Docker Compose is a tool that allows to define and share multi-container applications. With Compose, we can create a YAML file (e.g. `docker-compose.yaml`) to define the services and with a single command, can spin everything up or tear it all down. You can find more information about [Using Docker Compose and its advantages](https://docs.docker.com/get-started/08_using_compose/).

### Before you begin

To run Grafana via Docker Compose, install the compose tool your machine. To determine if the compose tool is available, run the following command:

```bash
docker compose version
```

If the compose tool is not available, refer to the [Compose tool](https://docs.docker.com/compose/install/) installation guide.

### Run the latest stable version of Grafana

This section shows you how to run Grafana using the Docker Compose. The examples in this section use Compose version 3. For more information about compatibility, refer to [Compose and Docker compatibility matrix](https://docs.docker.com/compose/compose-file/compose-file-v3/).

> **Note:** If you are on a Linux system (for example, Debian or Ubuntu), you might need to add **sudo** before the command or add your user to the **docker** group. For more information, refer to [Linux post-installation steps for Docker Engine](https://docs.docker.com/engine/install/linux-postinstall/).

To run the latest stable version of Grafana using Docker Compose, complete the following steps:

1. Create a `docker-compose.yaml` file.

   For example:

   ```bash
    version: "3.8"
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
   # first go into the directory where you have created this docker-compose.yaml file
   cd /path/to/docker-compose-folder 

   # then start the grafana container 
   docker compose up -d docker-compose.yaml
   ```

   Where:

   d = detached mode \
   up = to bring the container up and running

To determine that Grafana is running, open a browser window and type `IP_ADDRESS:3000`. The sign in screen should appear.

### Stop the Grafana container

To stop the Grafana container, run the following command:

```bash
docker compose down
```

> **Note:** For more information about using Docker Compose commands, refer to [docker compose](https://docs.docker.com/engine/reference/commandline/compose/).

### Save your Grafana data

When you use Docker containers, the data inside them is temporary by default. This means that if you don't specify where to store the information, all the Grafana data will be lost when you stop the Docker container. To avoid losing your data, you can set up [persistent storage](https://docs.docker.com/storage/volumes/) or [bind mounts](https://docs.docker.com/storage/bind-mounts/) for your container.

#### Use persistent storage (recommended)

Complete the following steps to use persistent storage.

1. Create a `docker-compose.yaml` file 
   
1. Add the following code to the into it:
   ```yaml
   version: "3.8"
    services:
      grafana:
        image: grafana/grafana-enterprise
        container_name: grafana
        restart: unless-stopped
        ports:
          - '3000:3000'
    ```

1. Save the file and run the following command:

   ```bash
   docker compose up -d docker-compose.yaml
    ```

#### Use bind mounts

If you plan to use folders on your host for the database or configuration when running Grafana in Docker, you must start the container with a user that has the permission to access and write to the folder you map.

To use bind mounts, complete the following steps:

1. Create a new `docker-compose.yaml` file

1. Add the following code into it:

   ```yaml
   services:
     grafana:
       image: grafana/grafana-enterprise
       container_name: grafana
       restart: unless-stopped
       # if you are running as root then set it to 0
       # else find the right id with the id -u command
       user: "0"
       ports:
         - '3000:3000'
       volumes:
         - '$PWD/data:/var/lib/grafana'

1. Save the file and run the following command:

   ```bash
   docker compose up -d docker-compose.yaml
    ```

### Example

The following example runs the latest stable version of Grafana, listening on port 3000, with the container named "grafana", persistent storage in the grafana-storage docker volume, the server root URL set, and the official [clock panel](https://grafana.com/grafana/plugins/grafana-clock-panel/) plugin installed.

```bash
version: "3.8"
  services:
    grafana:
      image: grafana/grafana-enterprise
      container_name: grafana
      restart: unless-stopped
      environment:
	      - GF_SERVER_ROOT_URL=http://my.grafana.server/
        - GF_INSTALL_PLUGINS=grafana-clock-panel
      ports:
        - '3000:3000'
      volumes:
        - 'grafana_storage:/var/lib/grafana'
  volumes:
    grafana_storage: {}
```

> **Note:** If you want to specify the version of a plugin, add the version number to the `GF_INSTALL_PLUGINS` environment variable. For example: `-e "GF_INSTALL_PLUGINS=grafana-clock-panel 1.0.1,grafana-simple-json-datasource 1.3.5"`. If you do not specify a version number, the latest version is used.

## Next steps

Refer to the [Getting Started]({{< relref "../../../getting-started/build-first-dashboard/" >}}) guide for information about logging in, setting up data sources, and so on.

## Configure Docker image

Refer to [Configure a Grafana Docker image]({{< relref "../../configure-docker/" >}}) page for details on options for customizing your environment, logging, database, and so on.

## Configure Grafana

Refer to the [Configuration]({{< relref "../../configure-grafana/" >}}) page for details on options for customizing your environment, logging, database, and so on.
