+++
title = "Installing on Mac"
description = "Installing Grafana on Mac"
keywords = ["grafana", "configuration", "documentation", "mac", "homebrew", "osx"]
type = "docs"
[menu.docs]
parent = "installation"
weight = 4
+++


# Installing on Mac

Installation can be done using [homebrew](http://brew.sh/)

Install latest stable:

```bash
brew update
brew install grafana
```

To start grafana look at the command printed after the homebrew install completes.

To upgrade use the reinstall command

```bash
brew update
brew reinstall grafana
```

-------------

You can also install the latest unstable grafana from git:


```bash
brew install --HEAD grafana/grafana/grafana
```

To upgrade grafana if you've installed from HEAD:

```bash
brew reinstall --HEAD grafana/grafana/grafana
```

### Starting Grafana

To start Grafana using homebrew services first make sure homebrew/services is installed.

```bash
brew tap homebrew/services
```

Then start Grafana using:

```bash
brew services start grafana
```


### Configuration

The Configuration file should be located at `/usr/local/etc/grafana/grafana.ini`.

### Logs

The log file should be located at `/usr/local/var/log/grafana/grafana.log`.

### Plugins

If you want to manually install a plugin place it here: `/usr/local/var/lib/grafana/plugins`.

### Database

The default sqlite database is located at `/usr/local/var/lib/grafana`

