+++
title = "Installing on NixOS"
description = "Install guide for Grafana"
keywords = ["grafana", "installation", "documentation"]
type = "docs"
aliases = ["/installation/installation/nixos"]
[menu.docs]
name = "Installing on NixOS"
identifier = "nixos"
parent = "installation"
weight = 1
+++

# Installing on NixOS
In the following example configuration, all options except for the `enable` option are just for illustrational purpose, as they have the shown values by default.
For lots of additional configuration options you can visit [nixos.org](https://nixos.org/nixos/options.html#services.grafana) or take a look at the `man configuration.nix` on your system.

To run `grafana` on your NixOS installation, simply add this snippet to your system configuration:
```nix
...

services.grafana = {
  enable   = true;
  port     = 3000;
  domain   = "localhost";
  protocol = "http";
  dataDir  = "/var/lib/grafana";
};

...
```
Now rebuild your system by using nixos-rebuild:
```bash
nixos-rebuild switch
```
And you're done!


## Module details

- All configuration is handled by the NixOS module.
- Non-exposed options can be passed to the service by using the module's `extraOptions` option.
- Starts a new systemd service `grafana-server.service`
- Logs will be placed in `/var/lib/grafana/log/` by default
- The default configuration specifies an sqlite3 db at `/var/lib/grafana/data/grafana.db`
- `grafana-cli` and `grafana-server` are added to your `environment.systemPackages` by the module

## Controlling the server (via systemd)
###### When the grafana module is enabled, the systemd service will start automatically.

To stop/start/restart the service using systemd's systemctl:

```bash
systemctl stop grafana.service
systemctl start grafana.service
systemctl restart grafana-server
```
The service's logs in the systemd-journal can be accessed using `journalctl`:
```bash
journalctl -efu grafana.service
```

## Database

The default configuration specifies a sqlite3 database located at
`/var/lib/grafana/data/grafana.db`. Please backup this database before
upgrades. You can also use MySQL or Postgres as the Grafana database, as detailed on [the configuration page]({{< relref "configuration.md#database" >}}).

## Configuration

All configuration is handled by the NixOS module.
For a list of available configuration options, take a look at the available options on [nixos.org](https://nixos.org/nixos/options.html#services.grafana).
Additional options can be passed by using the module's `extraOptions` option.

## Adding data sources

- [Graphite]({{< relref "features/datasources/graphite.md" >}})
- [InfluxDB]({{< relref "features/datasources/influxdb.md" >}})
- [OpenTSDB]({{< relref "features/datasources/opentsdb.md" >}})
- [Prometheus]({{< relref "features/datasources/prometheus.md" >}})
