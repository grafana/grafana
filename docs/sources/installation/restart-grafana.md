+++
title = "Restart Grafana"
description = "Instructions for restarting Grafana"
keywords = ["grafana", "restart", "documentation"]
weight = 750
+++

# Restart Grafana

Users often need to restart the Grafana service after they have made configuration changes. This topic provides detailed instructions on how to restart the service on supported operating systems.

- [Windows](#windows)
- [MacOS](#macos)
- [Linux](#linux)
- [Docker](#docker)

## Windows

To restart Grafana:

1. Open the Services app.
1. Right-click on the **Grafana** service.
1. In the context menu, click **Restart**.

## macOS

To restart Grafana that was installed using standalone macOS binaries:

1. Open a terminal and go to the directory where you copied the install setup files. 
1. Run the command:

```bash
./bin/grafana-server web
```

If you installed Grafana using [Homebrew](http://brew.sh/), use rge restart command:

`brew services restart grafana`
## Linux

Restart methods differ depending on whether your Linux system uses `systemd` or `init.d`.

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

To restart the Grafana service, use the `docker restart` command. For example:

`docker restart grafana`

Alternately, you can use the `docker compose restart` command to restart Grafana. For more information, refer to [docker compose documentation](https://docs.docker.com/compose/).

### Docker compose example

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
Start the server using this command:

`docker-compose up`

This starts the Grafana server along with the three plugins specified in the YAML file.

To restart the running container, use this command:

`docker-compose restart grafana`
