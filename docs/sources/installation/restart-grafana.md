+++
title = "Restart Grafana"
description = "Installation guide for Grafana"
keywords = ["grafana", "restart", "documentation"]
weight = 750
+++

# Restart Grafana

Users often need to restart the Grafana service after they have made configuration changes. This topic provides detailed instructions on how to restart the service on supported operating systems.

- [Windows](#windows)
- [MacOS](#macos)
- [Linux](linux)
- [Docker](#docker)

## Windows

To restart Grafana:

1. Open the Services app.
2. Right-click on the **Grafana** service.
3. In the context menu, click **Restart**.

## macOS

To restart Grafana, go to the directory where you copied the install setup files. Then run the command:

```bash
./bin/grafana-server web
```


## Linux

These instructions are applicable for restarting Grafana installed on Debian or Ubuntu, as well as on the RPM-based Linux systems (CentOS, Fedora, OpenSuse, Red Hat).

### Restart the server with systemd

To restart the service and verify that the service has started, run the following commands:

```bash
sudo systemctl restart grafana-server
sudo systemctl status grafana-server
```

Alternately, you can configure the Grafana server to restart at boot:

```bash
sudo systemctl enable grafana-server.service
```

> **Note:** SUSE or OpenSUSE users may need to start the server with the systemd method, then use the init.d method to configure Grafana to start at boot.

### Restart the server with init.d

To restart the service, run the following command:

`sudo service grafana-server restart`

or

`sudo /etc/init.d/grafana-server restart`

Verify the status:

`sudo service grafana-server status`

or

`sudo /etc/init.d/grafana-server status`

Alternately, you can configure the Grafana server to restart at boot:

```bash
sudo update-rc.d grafana-server defaults
```
## Docker

To restart the Grafana service, use the `docker run` command. For example:

`docker run -d -p 3000:3000 --name grafana grafana/grafana:latest`

This will restart the Grafana service and run it in the background.

Alternately, you can use the `docker compose` command to restart Grafana. For more information, refer to [docker compose documentation](https://docs.docker.com/compose/).

### An example of using docker compose

Configure your `docker-compose.yml` file. For example:

```bash
grafana:
  image: grafana/grafana:latest
  ports:
    - "3000:3000"
  environment:
    - TERM=linux
    - GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-piechart-panel,grafana-polystat-panel
```
Run the command:

`docker-compose up`

Grafana along with the three plugins specified in the YAML file are up and running.

