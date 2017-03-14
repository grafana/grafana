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

```
brew update
brew install grafana
```

To start grafana look at the command printed after the homebrew install completes.

To upgrade use the reinstall command

```
brew update
brew reinstall grafana
```

-------------

You can also install the latest unstable grafana from git:


```
brew install --HEAD grafana/grafana/grafana
```

To upgrade grafana if you've installed from HEAD:

```
brew reinstall --HEAD grafana/grafana/grafana
```
