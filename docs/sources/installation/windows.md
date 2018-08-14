+++
title = "Installing on Windows"
description = "Installing Grafana on Windows"
keywords = ["grafana", "configuration", "documentation", "windows"]
type = "docs"
[menu.docs]
parent = "installation"
weight = 3
+++

# Installing on Windows

Description | Download
------------ | -------------
Latest stable package for Windows | [x64](https://grafana.com/grafana/download?platform=windows)

Read [Upgrading Grafana]({{< relref "installation/upgrading.md" >}}) for tips and guidance on updating an existing
installation.

## Configure

**Important:** After you've downloaded the zip file and before extracting it, make sure to open properties for that file (right-click Properties) and check the `unblock` checkbox and `Ok`.

The zip file contains a folder with the current Grafana version. Extract
this folder to anywhere you want Grafana to run from.  Go into the
`conf` directory and copy `sample.ini` to `custom.ini`. You should edit
`custom.ini`, never `defaults.ini`.

The default Grafana port is `3000`, this port requires extra permissions
on windows. Edit `custom.ini` and uncomment the `http_port`
configuration option (`;` is the comment character in ini files) and change it to something like `8080` or similar.
That port should not require extra Windows privileges.

Start Grafana by executing `grafana-server.exe`, located in the `bin` directory, preferably from the
command line. If you want to run Grafana as windows service, download
[NSSM](https://nssm.cc/). It is very easy to add Grafana as a Windows
service using that tool.

Read more about the [configuration options]({{< relref "configuration.md" >}}).

## Building on Windows

The Grafana backend includes Sqlite3 which requires GCC to compile. So
in order to compile Grafana on Windows you need to install GCC. We
recommend [TDM-GCC](http://tdm-gcc.tdragon.net/download).

## Logging in for the first time

To run Grafana open your browser and go to port 3000 which is the default port. If you have changed the port you go to that port. There you will see the login page. User name is admin and password is admin. When you log in for the first time you will be asked to change your password. You can later go to user preferences and change your user name.

Here you can get help [getting started](https://www.youtube.com/watch?v=sKNZMtoSHN4&index=7&list=PLDGkOdUX1Ujo3wHw9-z5Vo12YLqXRjzg2) with your dashboards.