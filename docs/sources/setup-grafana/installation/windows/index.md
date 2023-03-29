---
aliases:
  - ../../installation/windows/
description: How to install Grafana OSS or Enterprise on Windows
title: Install Grafana on Windows
menutitle: Windows
weight: 500
---

# Install Grafana on Windows

You install Grafana using the Windows installer or using the standalone Windows binary file.

1. Navigate to the [Grafana download page](https://grafana.com/grafana/download).
1. Select the Grafana version you want to install.
   - The most recent Grafana version is selected by default.
   - The **Version** field displays only tagged releases. If you want to install a nightly build, click **Nightly Builds** and then select a version.
1. Select an **Edition**.
   - **Enterprise:** This is the recommended version. It is functionally identical to the open source version, but includes features you can unlock with a license, if you so choose.
   - **Open Source:** This version is functionally identical to the Enterprise version, but you will need to download the Enterprise version if you want Enterprise features.
1. Click **Windows**.
1. To use the Windows installer, complete the following steps:

   a. Click **Download the installer**.

   b. Open and run the installer.

1. To install the standalone Windows binary, complete the following steps:

   a. Click **Download the zip file**.

   b. Right-click the downloaded file, select **Properties**, select the `unblock` checkbox, and click `OK`.

   c. Extract the ZIP file to any folder.

Start Grafana by executing `grafana-server.exe`, located in the `bin` directory, preferably from the command line. If you want to run Grafana as a Windows service, then download
[NSSM](https://nssm.cc/). It is very easy to add Grafana as a Windows service using that tool.

1. To run Grafana, open your browser and go to the Grafana port (http://localhost:3000/ is default) and then follow the instructions in [Getting Started]({{< relref "../../../getting-started/build-first-dashboard/" >}}).

   > **Note:** The default Grafana port is `3000`. This port might require extra permissions on Windows. If it does not appear in the default port, you can change the port number.

1. To change the port, perform the following steps:

   a. Open the `conf` directory and copy `sample.ini` to `custom.ini`.

   > **Note:** You should edit `custom.ini`, never `defaults.ini`.

   b. Edit `custom.ini` and uncomment the `http_port` configuration option.

   `;` is the comment character in ini files.

   c. Change the port to `8080` or something similar.

   Port `8080` should not require extra Windows privileges.

## Upgrade Grafana

While the process for upgrading Grafana is very similar to installing Grafana, there are important backup tasks you should perform. Refer to [Upgrade Grafana]({{< relref "../../../upgrade-guide/" >}}) for guidance on updating an existing installation.

## Next steps

- [Start the Grafana server]({{< relref "../../start-restart-grafana/" >}})
