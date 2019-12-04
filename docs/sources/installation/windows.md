+++
title = "Install on Windows"
description = "Installing Grafana on Windows"
keywords = ["grafana", "configuration", "documentation", "windows"]
type = "docs"
[menu.docs]
parent = "installation"
weight = 400
+++

# Install on Windows

[Download the latest stable package for Windows.](https://grafana.com/grafana/download?platform=windows)

You can either download the Windows installer package or a standalone Windows binary file.

Read [Upgrading Grafana]({{< relref "installation/upgrading.md" >}}) for tips and guidance on updating an existing
installation.

## Install with Windows installer

Download the .msi installation file and run it, then follow the instructions in [Getting Started](/guides/getting_started/) to log in. The Grafana service starts automatically.

## Install standalone Windows binary

1. Download the zip file. The zip file contains a folder with the current Grafana version (or the one that you chose).

   **Important:** After you've downloaded the zip file and before extracting it, make sure to open the properties for that file (right-click **Properties**) and select the `unblock` check box and then click `Ok`.

1. Extract this folder to anywhere you want Grafana to run from. 
 
1. Go into the `conf` directory and copy `sample.ini` to `custom.ini`. **Note:** You should edit `custom.ini`, never `defaults.ini`.

1. The default Grafana port is `3000`. This port requires extra permissions on Windows. Edit `custom.ini` and uncomment the `http_port` configuration option (`;` is the comment character in ini files) and change it to something like `8080` or similar. That port should not require extra Windows privileges.

1. Start Grafana by executing `grafana-server.exe`, located in the `bin` directory, preferably from the command line. If you want to run Grafana as a Windows service, then download
[NSSM](https://nssm.cc/). It is very easy to add Grafana as a Windows service using that tool.

Read more about the [configuration options]({{< relref "configuration.md" >}}).

To run Grafana open your browser and go to the port you configured above, such as http://localhost:8080/, and then follow the instructions in [Getting Started](/guides/getting_started/).
