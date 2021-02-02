+++
title = "Restart Grafana"
description = "Installation guide for Grafana"
keywords = ["grafana", "restart", "documentation"]
weight = 30
+++

# Restart Grafana

This topic will help you the restart Grafana. The process of restarting Grafana on different operating systems are . This section has the following topics:

- [Requirements]({{< relref "requirements" >}})
- [Install on Debian or Ubuntu]({{< relref "debian" >}})
- [Install on RPM-based Linux (CentOS, Fedora, OpenSuse, RedHat)]({{< relref "rpm" >}})
- [Install on macOS]({{< relref "mac" >}})
- [Install on Windows]({{< relref "windows" >}})
- [Run Docker image]({{< relref "docker" >}})

## On Linux (Debian or Ubuntu)

### Start the server with init.d

To restart the service and verify that it has started:

```bash
    sudo service grafana-server start
    sudo service grafana-server status
```

Alternately, you can configure the Grafana server to restart at boot:

```bash
sudo update-rc.d grafana-server defaults
```

### Start the server with systemd

To start the service and verify that the service has started:

```bash
sudo systemctl start grafana-server
sudo systemctl status grafana-server
```

Configure the Grafana server to start at boot:

```bash
sudo systemctl enable grafana-server.service
```

Alternately, you can configure the Grafana server to restart at boot:

```bash
sudo update-rc.d grafana-server defaults
```

## On macOS

To restart Grafana, , go to the directory and run the command: 

```bash
    ./bin/grafana-server web
```


