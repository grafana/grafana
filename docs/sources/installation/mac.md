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

To install Grafana using [homebrew](http://brew.sh/), enter the following in the command line:

```bash
brew update
brew install grafana
```

To start Grafana, run the command printed after the Homebrew installation completes.

## Upgrade with Homebrew

To upgrade Grafana, use the reinstall command:

```bash
brew update
brew reinstall grafana
```

### Start Grafana

To start Grafana using Homebrew services: 

```bash
brew services start grafana
```

Refer to [Getting started](docs\sources\guides\getting_started.md) for instructions on logging in for the first time and adding a data source.

## Install from binary .tar file

Download [the latest `.tar.gz` file](https://grafana.com/get) and extract it. The files extract into a folder named after the version you downloaded. This folder contains all files required to run Grafana. There are no init scripts or install scripts in this package.

Start Grafana by executing `./bin/grafana-server`. The `grafana-server` binary needs the working directory to be the root install directory where the binary and the `public` folder are located.
