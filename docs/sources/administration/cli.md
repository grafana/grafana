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

Grafana CLI has `plugins` and `admin` commands, as well as global options.

To list all commands and options:
```
grafana-cli -h
```

**Linux users**
Some commands, such as installing or removing plugins, require `sudo` in order to run.

**Windows users**
Some commands, such as installing or removing plugins, require you to run Windows PowerShell as Administrator.

Before you enter commands, `cd` into the Grafana bin directory. The default path is:
```
cd "C:\Program Files\GrafanaLabs\grafana\bin"
```

## Grafana CLI command syntax

The general syntax for commands in Grafana CLI is:
```bash
grafana-cli [global options] command [command options] [arguments...]
```

## Global options

Grafana CLI allows you to temporarily override certain Grafana default settings. Except for `--help` and `--version`, most global options are only used by developers.

Each global option applies only to the command in which it is used. For example, `--pluginsDir value` does not permanently change where Grafana saves plugins. It only changes it for command in which you apply the option.

### Display Grafana CLI help

`--help` or `-h` displays the help, including default paths and Docker configuration information.

**Example:**
```bash
grafana-cli -h
```

### Display Grafana CLI version

`--version` or `-v` prints the version of Grafana CLI currently running.

**Example:**
```bash
grafana-cli -v
```

### Override default plugin directory

`--pluginsDir value` overrides the path to where your local Grafana instance stores plugins. Use this option if you want to install, update, or remove a plugin somewhere other than the default directory ("/var/lib/grafana/plugins") [$GF_PLUGIN_DIR].

**Example:**
```bash
grafana-cli --pluginsDir "/var/lib/grafana/devplugins" plugins install <plugin-id>
```

### Override default plugin repo URL

`--repo value` allows you to download and install or update plugins from a repository other than the default Grafana repo.

**Example:**
```bash
grafana-cli --repo "https://example.com/plugins" plugins install <plugin-id>
```

### Override default plugin .zip URL

`--pluginUrl value` allows you to download a .zip file containing a plugin from a local URL instead of downloading it from the default Grafana source.

**Example:**
```bash
grafana-cli --pluginUrl https://company.com/grafana/plugins/<plugin-id>-<plugin-version>.zip plugins install <plugin-id>
```

### Override Transport Layer Security

**Warning:** Turning off TLS is a significant security risk. We do not recommend using this option.

`--insecure` allows you to turn off Transport Layer Security (TLS) verification (insecure). You might want to do this if you are downloading a plugin from a non-default source.

**Example:**
```bash
grafana-cli --insecure --pluginUrl https://company.com/grafana/plugins/<plugin-id>-<plugin-version>.zip plugins install <plugin-id>
```

### Enable debug logging

`--debug` or `-d` enables debug logging. Debug output is returned and shown in the terminal.

**Example:**
```bash
grafana-cli --debug plugins install <plugin-id>
```

### Override a configuration setting

`--configOverrides` is a command line argument that acts like an environmental variable override.

For example, you can use it to redirect logging to another file (maybe to log plugin installations in Grafana Cloud) or when resetting the admin password and you have non-default values for some important config value (like where the database is located).

**Example:**
```bash
grafana-cli --configOverrides cfg:default.paths.log=/dev/null plugins install <plugin-id>
```

### Override homepath value

Sets the path for the Grafana install/home path, defaults to working directory. You do not need to use this if you are in the Grafana installation directory when using the CLI.

**Example:**
```bash
grafana-cli --homepath "c:\Program Files\grafana" admin reset-admin-password mynewpassword
```

### Override config file

`--config value` overrides the default location where Grafana expects the configuration file. Refer to [Configuration]({{< relref "../administration/configuration.md" >}}) for more information about configuring Grafana and default configuration file locations.

**Example:**
```bash
grafana-cli --config "/etc/configuration/" admin reset-admin-password mynewpassword
```

## Plugins commands

Grafana CLI allows you to install, upgrade, and manage your Grafana plugins. For more information about installing plugins, refer to [plugins page]({{< relref "../plugins/installation.md" >}}).

All listed commands apply to the Grafana default repositories and directories. You can override the defaults with [Global Options](#global-options).

### List available plugins

```bash
grafana-cli plugins list-remote
```

### Install the latest version of a plugin

```bash
grafana-cli plugins install <plugin-id>
```

### Install a specific version of a plugin

```bash
grafana-cli plugins install <plugin-id> <version>
```

### List installed plugins

```bash
grafana-cli plugins ls
```

### Update all installed plugins
```bash
grafana-cli plugins update-all
```

### Update one plugin

```bash
grafana-cli plugins update <plugin-id>
```

### Remove one plugin

```bash
grafana-cli plugins remove <plugin-id>
```

## Admin commands

Admin commands are only available in Grafana 4.1 and later.

### Show all admin commands

```bash
grafana-cli admin
```

### Reset admin password

`grafana-cli admin reset-admin-password <new password>` resets the password for the admin user using the CLI. You might need to do this if you lose the admin password.

If there are two flags being used to set the homepath and the config file path, then running the command returns this error:

> Could not find config defaults, make sure homepath command line parameter is set or working directory is homepath

To correct this, use the `--homepath` global option to specify the Grafana default homepath for this command:

```bash
grafana-cli --homepath "/usr/share/grafana" admin reset-admin-password <new password>
```

If you have not lost the admin password, we recommend that you change the user password either in the User Preferences or in the Server Admin > User tab.

If you need to set the password in a script, then you can use the [Grafana User API]({{< relref "../http_api/user.md#change-password" >}}).

### Migrate data and encrypt passwords

`data-migration` runs a script that migrates or cleans up data in your database.

`encrypt-datasource-passwords` migrates passwords from unsecured fields to secure_json_data field. Returns `ok` unless there is an error. Safe to execute multiple times.

**Example:**
```bash
grafana-cli admin data-migration encrypt-datasource-passwords
```
