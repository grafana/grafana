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

To run Grafana open your browser and go to port 3000 which is the default port. If you have changed the port you go to that port. There you will see the login page. User name is admin and password is admin. When you log in for the first time you will be asked to change your password. You can later go to user preferences and change your user name.

Here you can get help [getting started](https://www.youtube.com/watch?v=sKNZMtoSHN4&index=7&list=PLDGkOdUX1Ujo3wHw9-z5Vo12YLqXRjzg2) with your dashboards.