+++
title = "Grafana CLI"
description = "Guide to using grafana-cli"
keywords = ["grafana", "cli", "grafana-cli", "command line interface"]
type = "docs"
[menu.docs]
parent = "admin"
weight = 8
+++

# Grafana CLI

Grafana CLI is a small executable that is bundled with Grafana server and is supposed to be executed on the same machine Grafana server is running on.

Grafana CLI has `plugins ` and `admin` commands, as well as global options.

To list all commands and options:
```
grafana-cli -h
```

**Linux users**
Some commands, such as installing or removing plugins, require `sudo` in order to run.

**Windows users**
Enter commands in Windows PowerShell, preceded by `.\`. They will not work in the command line.

Some commands, such as installing or removing plugins, require you to run Windows PowerShell as Administrator. 

Before you enter commands, `cd` into the plugins directory. The default path is:
```
cd "C:\Program Files\GrafanaLabs\grafana\bin"
```

## Global options

 --pluginsDir value       path to the grafana plugin directory (default: "/var/lib/grafana/plugins") [$GF_PLUGIN_
DIR]
   --repo value             url to the plugin repository (default: "https://grafana.com/api/plugins") [$GF_PLUGIN_R
EPO]
   --pluginUrl value        Full URL to the plugin zip file instead of downloading the plugin from grafana.com/api [$GF_PLUGIN_URL]
   --insecure               Skip TLS verification (insecure)
   --debug, -d              enable debug logging
   --configOverrides value  configuration options to override defaults as a string. e.g. cfg:default.paths.log=/dev/null
   --homepath value         path to grafana install/home path, defaults to working directory
   --config value           path to config file
   --help, -h               show help
   --version, -v            print the version

## Plugins commands

Grafana CLI allows you to install, upgrade, and manage your Grafana plugins. For more information about installing plugins, refer to [plugins page]({{< relref "../plugins/installation.md" >}}).

### Grafana Plugin Directory

On Linux systems the grafana-cli will assume that the grafana plugin directory is `/var/lib/grafana/plugins`. It's possible to override the directory which grafana-cli will operate on by specifying the --pluginsDir flag. On Windows systems this parameter have to be specified for every call.


List available plugins
```bash
grafana-cli plugins list-remote
```

Install the latest version of a plugin
```bash
grafana-cli plugins install <plugin-id>
```

Install a specific version of a plugin
```bash
grafana-cli plugins install <plugin-id> <version>
```

List installed plugins
```bash
grafana-cli plugins ls
```

Update all installed plugins
```bash
grafana-cli plugins update-all
```

Update one plugin
```bash
grafana-cli plugins update <plugin-id>
```

Remove one plugin
```bash
grafana-cli plugins remove <plugin-id>
```

## Admin

> This feature is only available in Grafana 4.1 and above.

To show all admin commands:
`grafana-cli admin`

### Reset admin password

You can reset the password for the admin user using the CLI. The use case for this command is when you have lost the admin password.

`grafana-cli admin reset-admin-password ...`

If running the command returns this error:

> Could not find config defaults, make sure homepath command line parameter is set or working directory is homepath

then there are two flags that can be used to set homepath and the config file path.

`grafana-cli --homepath "/usr/share/grafana" admin reset-admin-password newpass`

If you have not lost the admin password then it is better to set in the Grafana UI. If you need to set the password in a script then the [Grafana API](http://docs.grafana.org/http_api/user/#change-password) can be used. Here is an example using curl with basic auth:

```bash
curl -X PUT -H "Content-Type: application/json" -d '{
  "oldPassword": "admin",
  "newPassword": "newpass",
  "confirmNew": "newpass"
}' http://admin:admin@<your_grafana_host>:3000/api/user/password
```
