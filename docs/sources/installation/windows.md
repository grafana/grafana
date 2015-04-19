---
page_title: Installing on Windows
page_description: Grafana Installation guide for Windows
page_keywords: grafana, installation, windows guide
---

# Installing on Windows

There are currently no binary build for Windows. But read the [build from source](../project/building_from_source)
page for instructions on how to build it yourself.

## Building on Windows

The Grafana backend includes Sqlite3 which requires GCC to compile. So in order to compile Grafana on windows you need
to install GCC. We recommend [TDM-GCC](http://tdm-gcc.tdragon.net/download).

Copy conf/sample.ini to a file named conf/custom.ini and change the web server port to something like 8080. The default
Grafana port(3000) requires special privileges on Windows.
