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

## Install using homebrew

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

Default login and password `admin`/ `admin`


### Configuration

The Configuration file should be located at `/usr/local/etc/grafana/grafana.ini`.

### Logs

The log file should be located at `/usr/local/var/log/grafana/grafana.log`.

### Plugins

If you want to manually install a plugin place it here: `/usr/local/var/lib/grafana/plugins`.

### Database

The default sqlite database is located at `/usr/local/var/lib/grafana`

## Installing from binary tar file

Download [the latest `.tar.gz` file](https://grafana.com/get) and
extract it.  This will extract into a folder named after the version you
downloaded. This folder contains all files required to run Grafana.  There are
no init scripts or install scripts in this package.

To configure Grafana add a configuration file named `custom.ini` to the
`conf` folder and override any of the settings defined in
`conf/defaults.ini`.

Start Grafana by executing `./bin/grafana-server web`. The `grafana-server`
binary needs the working directory to be the root install directory (where the
binary and the `public` folder is located).

## Logging in for the first time

To run Grafana open your browser and go to http://localhost:3000/. 3000 is the default http port that Grafana listens to if you haven't [configured a different port](/installation/configuration/#http-port).
Then follow the instructions [here](/guides/getting_started/).