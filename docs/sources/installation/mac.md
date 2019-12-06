+++
title = "Installing on macOS"
description = "Installing Grafana on macOS"
keywords = ["grafana", "configuration", "documentation", "mac", "homebrew", "osx"]
type = "docs"
[menu.docs]
parent = "installation"
weight = 500
+++


# Installing on macOS

This page provides instructions to help you install Grafana on macOS. You can either install using homebrew or a binary tar file.


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

### Start Grafana

To start Grafana using homebrew services first make sure homebrew/services is installed.

```bash
brew tap homebrew/services
```

Then start Grafana using:

```bash
brew services start grafana
```

Default login and password `admin`/ `admin`

## Install from binary tar file

Download [the latest `.tar.gz` file](https://grafana.com/get) and
extract it.  This will extract into a folder named after the version you
downloaded. This folder contains all files required to run Grafana.  There are
no init scripts or install scripts in this package.

To configure Grafana add a configuration file named `custom.ini` to the
`conf` folder and override any of the settings defined in
`conf/defaults.ini`.

### Start Grafana

Start Grafana by executing `./bin/grafana-server`. The `grafana-server` binary needs the working directory to be the root install directory (where the binary and the `public` folder is located).
