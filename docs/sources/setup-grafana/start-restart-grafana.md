---
aliases:
  - ../installation/restart-grafana/
  - ./restart-grafana/
description: How to start the Grafana server
title: Start the Grafana server
menuTitle: Start Grafana
weight: 300
---

# Start the Grafana server

This topic includes instructions for starting the Grafana server. For certain configuration changes, you might have to restart the Grafana server for them to take effect.

The following instructions start the `grafana-server` process as the `grafana` user, which was created during the package installation.

If you installed with the APT repository or `.deb` package, then you can start the server using `systemd` or `init.d`. If you installed a binary `.tar.gz` file, then you execute the binary.

## Linux

The following subsections describe three methods of starting and restarting the Grafana server: with systemd, initd, or by directly running the binary. You should follow only one set of instructions, depending on how your machine is configured.

### Start the Grafana server with systemd

Complete the following steps to start the Grafana server using systemd and verify that it is running:

1. To start the service, run the following commands:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl start grafana-server
   sudo systemctl status grafana-server
   ```

1. To verify that the service is running, run the following command:

   ```
   sudo systemctl status grafana-server
   ```

### Configure the Grafana server to start at boot using systemd

To configure the Grafana server to start at boot, run the following command:

```bash
sudo systemctl enable grafana-server.service
```

#### Serve Grafana on a port < 1024

{{< docs/shared "systemd/bind-net-capabilities.md" >}}

### Restart the Grafana server using systemd

To restart the Grafana server, run the following commands:

```bash
sudo systemctl restart grafana-server
```

> **Note:** SUSE or OpenSUSE users might need to start the server with the systemd method, then use the init.d method to configure Grafana to start at boot.

### Start the Grafana server using init.d

Complete the following steps to start the Grafana server using init.d and verify that it is running:

1. To start the Grafana server, run the following commands:

   ```bash
   sudo service grafana-server start
   sudo service grafana-server status
   ```

1. To verify that the service is running, run the following command:

   ```
   sudo service grafana-server status
   ```

### Configure the Grafana server to start at boot using init.d

To configure the Grafana server to start at boot, run the following command:

```bash
sudo update-rc.d grafana-server defaults
```

#### Restart the Grafana server using init.d

To restart the Grafana server, run the following commands:

```bash
sudo service grafana-server restart
```

### Start the server using the binary

The `grafana-server` binary .tar.gz needs the working directory to be the root install directory where the binary and the `public` folder are located.

To start the Grafana server, run the following command:

```bash
./bin/grafana-server
```

## Docker

To restart the Grafana service, use the `docker restart` command.

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

Start the Grafana server:

`docker-compose up`

This starts the Grafana server along with the three plugins specified in the YAML file.

To restart the running container, use this command:

`docker-compose restart grafana`

## Windows

Complete the following steps to start the Grafana server on Windows:

1. Execute `grafana-server.exe`, which is located in the `bin` directory.

   We recommend that you run `grafana-server.exe` from the command line.

   If you want to run Grafana as a Windows service, you can download [NSSM](https://nssm.cc/).

1. To run Grafana, open your browser and go to the Grafana port (http://localhost:3000/ is default).

   > **Note:** The default Grafana port is `3000`. This port might require extra permissions on Windows. If it does not appear in the default port, you can try changing to a different port.

1. If you need to change the port, complete the following steps:

   a. In the `conf` directory, copy `sample.ini` to `custom.ini`.

   > **Note:** You should edit `custom.ini`, never `defaults.ini`.

   b. Edit `custom.ini` and uncomment the `http_port` configuration option (`;` is the comment character in ini files) and change it to something similar to `8080`, which should not require extra Windows privileges.

To restart the Grafana server, complete the following steps:

1. Open the **Services** app.
1. Right-click on the **Grafana** service.
1. In the context menu, click **Restart**.

## macOS

Restart methods differ depending on whether you installed Grafana using Homebrew or as standalone macOS binaries.

### Restart Grafana using Homebrew

Use the [Homebrew](http://brew.sh/) restart command:

```bash
brew services restart grafana
```

### Restart standalone macOS binaries

To restart Grafana:

1. Open a terminal and go to the directory where you copied the install setup files.
1. Run the command:

```bash
./bin/grafana-server
```

## Next steps

After the Grafana server is up and running, consider taking the next steps:

- Refer to [Get Started]({{< relref "../getting-started/" >}}) to learn how to build your first dashboard.
- Refer to [Configuration]({{< relref "./configure-grafana/" >}}) to learn about how you can customize your environment.
