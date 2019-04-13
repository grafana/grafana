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

Default login and password `admin`/ `admin`


Start Grafana by executing `grafana-server.exe`, located in the `bin` directory, preferably from the
command line. If you want to run Grafana as windows service, download
[NSSM](https://nssm.cc/). It is very easy to add Grafana as a Windows
service using that tool.

Alternatively to run without [NSSM](https://nssm.cc/) it can be run
in the background as a process using the Windows Task Scheduler and
`PowerShell`.  This assumes the files are copied to
`C:\Program Files\grafana`.

* Open **Task Scheduler**
* On the right hand **Actions** menu, click on _`Create Task`_
* On the _General_ Tab
    * Set the _Name_ to **_`Grafana Server`_**.
    * Select **_Run whether user is logged on or not_**.
    * Click on **Change User or Group** button.
    * Enter **`SYSTEM`** for the name and click OK.
* On the _Triggers_ Tab
    * _Begin the task_ to **_On a schedule_.**
    * Select _Daily_ and set to **_Recur every `1` days_**.
    * Check _Repeat task every_ and set to **_every 15 minutes_** for a duration **_of `1` day_**.
* On the _Actions_ Tab
    * Configure the _Action_ to **_Start a Program_**.
    * Set the _Program/Script_ to **_`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`_**.
    * Configure the _Add Arguments (Optional)_ to:
    ```powershell
    -Command "& { if(!(Get-Process 'grafana-server' -ErrorAction 'SilentlyContinue' )) { Set-Location 'C:\Program Files\grafana'; Start-Process -FilePath 'C:\Program Files\grafana\bin\grafana-server.exe' -NoNewWindow  } } "
    ```
* Click `OK` until all windows are closed.
* On the right hand **Actions** menu, click on _`Run`_.

Read more about the [configuration options]({{< relref "configuration.md" >}}).

## Logging in for the first time

To run Grafana open your browser and go to the port you configured above, e.g. http://localhost:8080/.
Then follow the instructions [here](/guides/getting_started/).

## Building on Windows

The Grafana backend includes Sqlite3 which requires GCC to compile. So
in order to compile Grafana on Windows you need to install GCC. We
recommend [TDM-GCC](http://tdm-gcc.tdragon.net/download).
