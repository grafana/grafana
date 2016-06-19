---
page_title: Installing on Mac OS X
page_description: Grafana Installation guide for Mac OS X
page_keywords: grafana, installation, mac, osx, guide
---

# Installing on Mac

Installation can be done using [homebrew](http://brew.sh/)

Install latest stable:

```
brew install grafana/grafana/grafana
```

To start grafana look at the command printed after the homebrew install completes.

You can also add the grafana as tap.

```
brew tap grafana/grafana
brew install grafana
```

Install latest unstable from master:

```
brew install --HEAD grafana/grafana/grafana
```

To upgrade use the reinstall command

```
brew reinstall --HEAD grafana/grafana/grafana
```


