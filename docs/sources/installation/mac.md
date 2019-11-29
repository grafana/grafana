+++
title = "Install on macOS"
description = "Installing Grafana on macOS"
keywords = ["grafana", "configuration", "documentation", "mac", "homebrew", "osx"]
type = "docs"
[menu.docs]
parent = "installation"
weight = 500
+++


# Install on macOS

This page provides instructions to help you install Grafana on macOS. You can either install using Homebrew or a binary tar file.


## Install with Homebrew

Installation can be done using [homebrew](http://brew.sh/).

Install latest stable version:

```bash
brew update
brew install grafana
```

You can also install the latest unstable Grafana version from Git:

```bash
brew install --HEAD grafana/grafana/grafana
```

To start Grafana, run the command printed after the Homebrew install completes.

## Upgrade with Homebrew

To upgrade Grafana, use the reinstall command:

```bash
brew update
brew reinstall grafana
```

To upgrade grafana if you installed an unstable version from Git:

```bash
brew reinstall --HEAD grafana/grafana/grafana
```

### Start Grafana

To start Grafana using Homebrew services: 

First make sure that homebrew/services is installed:

```bash
brew tap homebrew/services
```

Then start Grafana using:

```bash
brew services start grafana
```

Refer to [Getting started](docs\sources\guides\getting_started.md) for instructions on logging in for the first time and adding a data source.

## Install from binary .tar file

Download [the latest `.tar.gz` file](https://grafana.com/get) and
extract it. The files extract into a folder named after the version you
downloaded. This folder contains all files required to run Grafana. There are
no init scripts or install scripts in this package.

To configure Grafana, add a configuration file named `custom.ini` to the
`conf` folder and override any of the settings defined in
`conf/defaults.ini`.

### Start Grafana

Start Grafana by executing `./bin/grafana-server`. The `grafana-server` binary needs the working directory to be the root install directory where the binary and the `public` folder are located.
