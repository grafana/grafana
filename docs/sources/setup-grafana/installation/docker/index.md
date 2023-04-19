---
aliases:
  - ../../installation/docker/
description: Guide for running Grafana using Docker
title: Run Grafana Docker image
weight: 200
---

# Run Grafana Docker image

You can install Grafana via Docker using the official Docker images. This topic explains how to run Grafana via the Docker command line (CLI) and docker-compose.

Grafana docker images come in two editions:

**Grafana Enterprise**: `grafana/grafana-enterprise`

**Grafana Open Source**: `grafana/grafana-oss`

> **Note:** Grafana Enterprise is the recommended and default edition. It is available for free and includes all the features of the OSS edition. You can also upgrade to the [full Enterprise feature set](#https://grafana.com/products/enterprise/?utm_source=grafana-install-page), which has support for [Enterprise plugins](https://grafana.com/grafana/plugins/?enterprise=1&utcm_source=grafana-install-page).

The default images are based on the popular Alpine Linux project, available in the Alpine official image.
For documentation regarding the configuration of a docker image, refer to [configure a Grafana Docker image](https://grafana.com/docs/grafana/latest/administration/configure-docker/).

# Run Grafana via Docker CLI

To run the latest stable version of Grafana, run the following command.

> **Note:** If you are on a Linux system (e.g. Debian, Ubuntu), you might need to add **sudo** before the command or add your user to the **docker** group by following this [documentation](https://docs.docker.com/engine/install/linux-postinstall/).

```bash
docker run -d -p 3000:3000 --name=grafana grafana/grafana-enterprise
```

where;

run = will run directly from the command line\
d = run in the background\
p = assign the port number (in this case running on 3000)\
name = assign a logical name to the container, for example, grafana\
grafana/grafana-enterprise = the image to run in the container

## Stop Grafana container

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

## Saving your Grafana data

By default, data inside Docker containers is ephemeral. If you do not designate a location for information storage then all your Grafana data disappear when you stop your Docker container. To save your data, set up [persistent storage](https://docs.docker.com/storage/volumes/) or [bind mounts](https://docs.docker.com/storage/bind-mounts/) for your container.

### Use persistent storage (recommended)
Complete the following steps to use persistent storage.

1. To create a Docker volume, run the following command:
   ```bash
   # create a persistent volume for your data
   docker volume create grafana-storage

   # verify that the volume was created correctly
   docker volume inspect grafana-storage
   ```
2. Then start the Grafana container by running the following command:
   ```bash
   # start grafana
   docker run -d -p 3000:3000 --name=grafana \
   --volume grafana-storage:/var/lib/grafana \
   grafana/grafana-enterprise
   ```

### Use bind mounts

You might want to run Grafana in Docker but use folders on your host for the database or configuration. With this approach, it is important to start the container with a user that can access and write to the folder you map into the container:

To use bind mounts, run the following command:
```bash
# create a folder for your data
mkdir data

# start grafana with your user id and using the data folder
docker run -d -p 3000:3000 --name=grafana \
--user "$(id -u)" --volume "$PWD/data:/var/lib/grafana" \
grafana/grafana-enterprise
```

## Use environment variables

Grafana supports specifying custom configuration settings via [environment variables](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#override-configuration-with-environment-variables) within your Docker container.

```bash
# enabling public dashboard feature

docker run -d -p 3000:3000 --name=grafana \
-e "GF_FEATURE_TOGGLES_ENABLE=publicDashboards" \
grafana/grafana-enterprise
```

## Install plugins in the Docker container

You can install official and community plugins listed on the Grafana [plugins page](https://grafana.com/grafana/plugins) or private plugins from a custom URL. Plugins allow you to add new types of visualizations, Datasource, and Applications to visualise your data. Currently, Grafana supports three types of plugins: panel, datasource, and app. Check the [Plugin management](https://grafana.com/docs/grafana/latest/administration/plugin-management/) for more information.

### Install Grafana plugins
Pass the plugins you want to be installed to Docker with the `GF_INSTALL_PLUGINS` environment variable as a comma-separated list. This sends each plugin name to `grafana-cli plugins install ${plugin}` and installs them when Grafana starts.

```bash
docker run -d -p 3000:3000 --name=grafana \
-e "GF_INSTALL_PLUGINS=grafana-clock-panel grafana-simple-json-datasource" grafana/grafana-enterprise
```

If you need to specify the version of a plugin, then you can add it to the `GF_INSTALL_PLUGINS` environment variable. Otherwise, the latest is used.

```bash
docker run -d -p 3000:3000 --name=grafana \
-e "GF_INSTALL_PLUGINS=grafana-clock-panel 1.0.1" \
grafana/grafana-enterprise
```
It is possible to install a plugin from a custom URL by specifying the URL like this: `<url to plugin zip>;<plugin install folder name>`

```bash
docker run -d -p 3000:3000 --name=grafana \
-e "GF_INSTALL_PLUGINS=https://github.com/VolkovLabs/custom-plugin.zip;custom-plugin" \
grafana/grafana-enterprise
```

# Example
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

# Running Grafana via Docker Compose

Docker Compose is a tool that allows to define and share multi-container applications. With Compose, we can create a YAML file (e.g. `docker-compose.yaml`) to define the services and with a single command, can spin everything up or tear it all down. You can find more information about [Using Docker Compose and its advantages](https://docs.docker.com/get-started/08_using_compose/).

## Prerequisites

Make sure that you have the compose tool installed on your machine. You can check if its available by running the command:

```bash
docker compose version
```

If it does not exist, then check the official [Compose tool](https://docs.docker.com/compose/install/) installation guide.

## Run the latest stable version of Grafana

> **Note:** If you are on a Linux system (e.g. Debian, Ubuntu), you might need to add **sudo** before the command or add your user to the **docker** group by following this [documentation](https://docs.docker.com/engine/install/linux-postinstall/).

> **Note:** We will be using the compose version **v3** in our example `docker-compose.yaml` file. You can read more about the [Compose and Docker compatibility matrix](https://docs.docker.com/compose/compose-file/compose-file-v3/)

Example `docker-compose.yaml`

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
In order to run the above `docker-compose.yaml` will need to use the following command:

```bash
# first go into the directory where you have created this docker-compose.yaml file
cd /path/to/docker-compose-folder 

# then start the grafana container 
docker compose up -d docker-compose.yaml
```
Where;

d = detached mode \
up = to bring the container up and running

You should go to your browser and type your machine **IP_ADDRESS:3000** and will be able to access Grafana.

## Stop the Grafana container

To stop the Grafana container, run the following command:

```bash
docker compose down
```
> **Note:** Read more here about the [docker compose command](https://docs.docker.com/engine/reference/commandline/compose/) usage

## Saving your Grafana data

If you do not designate a location for information storage, then all your Grafana data disappears as soon as you stop your Docker container. To save your data, you need to set up persistent storage or bind mounts for your container.

### Using persistent storage **(recommended)**

Complete the following steps to use persistent storage.

1. Create a new `docker-compose.yaml` file
   
2. Add the following code into it:
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

3. Save the file and on the terminal run the command:
   ```bash
   docker compose up -d docker-compose.yaml
    ```

### Using bind mounts

You might want to run Grafana in Docker but use folders on your host for the database or configuration. With this approach, it is important to start the container with a user that can access and write to the folder you map into the container:

To use bind mounts, complete the following steps:

1. Create a new `docker-compose.yaml` file

2. Add the following code into it:

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

3. Save the file and on the terminal run the command:

   ```bash
   docker compose up -d docker-compose.yaml
    ```

# Example

This following example runs the latest stable version of Grafana, listening on port 3000, with the container named "grafana", persistent storage in the grafana-storage docker volume, the server root URL  set, and the official [clock panel](<https://grafana.com/grafana/plugins/grafana-clock-panel/>) plugin installed

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

> **Note:** If you need to specify the version of a plugin, then you can add it to the `GF_INSTALL_PLUGINS` environment variable. Otherwise, the latest is used. For example: `-e "GF_INSTALL_PLUGINS=grafana-clock-panel 1.0.1,grafana-simple-json-datasource 1.3.5"`

## Next steps

Refer to the [Getting Started]({{< relref "../../../getting-started/build-first-dashboard/" >}}) guide for information about logging in, setting up data sources, and so on.

## Configure Docker image

Refer to [Configure a Grafana Docker image]({{< relref "../../configure-docker/" >}}) page for details on options for customizing your environment, logging, database, and so on.

## Configure Grafana

Refer to the [Configuration]({{< relref "../../configure-grafana/" >}}) page for details on options for customizing your environment, logging, database, and so on.
