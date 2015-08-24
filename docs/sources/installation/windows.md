---
page_title: Installing on Windows
page_description: Grafana Installation guide for Windows
page_keywords: grafana, installation, windows guide
---

# Installing on Windows

## Download

Description | Download
------------ | -------------
Zip package for Windows | [grafana.2.1.3.windows-x64.zip](https://grafanarel.s3.amazonaws.com/winbuilds/dist/grafana-2.1.3.windows-x64.zip)

## Configure

The zip file contains a folder with the current Grafana version. Extract
this folder to anywhere you want Grafana to run from.  Go into the
`conf` directory and copy `sample.ini` to `custom.ini`. You should edit
`custom.ini`, never `defaults.ini`.

The default Grafana port is `3000`, this port requires extra permissions
on windows. Edit `custom.ini` and uncomment the `http_port`
configuration option and change it to something like `8080` or similar.
That port should not require extra Windows privileges.

Start Grafana by executing `grafana-server.exe`, preferably from the
command line. If you want to run Grafana as windows service, download
[NSSM](https://nssm.cc/). It is very easy add Grafana as a Windows
service using that tool.

Read more about the [configuration options](/installation/configuration).

## Building on Windows

The Grafana backend includes Sqlite3 which requires GCC to compile. So
in order to compile Grafana on Windows you need to install GCC. We
recommend [TDM-GCC](http://tdm-gcc.tdragon.net/download).

Copy `conf/sample.ini` to a file named `conf/custom.ini` and change the
web server port to something like 8080. The default Grafana port, 3000,
requires special privileges on Windows.
