---
title: Develop with a local environment
---

# Develop with a local environment

Follow the steps in this guide to set up a development environment where you run Grafana and your plugin locally. With this setup, you can see your changes as you add them.

## Before you begin

We recommend that you have the most recent stable versions of Git, Go, and NodeJS installed on your system.

## Run Grafana in your host

Here's how to clone and run Grafana locally:

1. Download and set up Grafana. Refer to the [developer-guide](https://github.com/grafana/grafana/blob/HEAD/contribute/developer-guide.md).

2. Grafana looks for plugins, by default, in its `data/plugins` directory. You can create a symbolic link to your plugin repository to detect new changes:

   ```bash
   ln -s <plugin-path>/dist data/plugins/<plugin-name>
   ```

3. Optional: If the step above doesn't work for you (for example, if you are running on Windows), then modify the default path in the Grafana configuration. Find the default path at `conf/custom.ini`) and point it to your plugin's directory:

   ```ini
   [paths]
   plugins = <path-to-your-plugin-parent-directory>
   ```

## Run Grafana with `docker-compose`

Another option is to run Grafana with docker-compose so that it runs in a container. To do so, create the `docker-compose` file in your plugin directory.

> **Note:**: If your plugin already includes a docker-compose, then skip this step.

```yaml
version: '3.7'

services:
  grafana:
    # Change latest with your target version, if needed
    image: grafana/grafana:latest
    ports:
      - 3000:3000/tcp
    volumes:
      # Use your plugin folder (for example, redshift-datasource)
      - ./dist:/var/lib/grafana/plugins/<plugin-folder>
      - ./provisioning:/etc/grafana/provisioning
    environment:
      - TERM=linux
      - GF_LOG_LEVEL=debug
      - GF_DATAPROXY_LOGGING=true
      - GF_DEFAULT_APP_MODE=development
```

## Run your plugin in development mode

Finally, start your plugin in development mode. Go to your plugin's root directory and follow these steps:

1. Build your plugin backend and start the frontend in watch mode:

   ```bash
   mage -v
   yarn watch
   ```

2. Start the Grafana backend and frontend:

   a. For a local copy of Grafana, go to the directory with Grafana source code and run:

   ```bash
   make run
   ```

   ```bash
   yarn start
   ```

   b. Or, with docker-compose in your plugin directory, run:

   ```bash
   docker-compose up
   ```

After this, you should be able to see your plugin listed in Grafana, and then you can test your changes. 

If you make a change in the fronted, you must refresh your browser. However, changes in the backend may require that you rebuild your plugin binaries and reload the plugin (`mage && mage reloadPlugin` for local development, or run `docker-compose up` again if you are using docker-compose).

## Run your backend plugin with a debugger

> Note: The following method only works with a local Grafana instance and currently doesn't work with Docker.

Running a backend plugin with a debugger is a feature that supports Visual Studio Code and GoLand out of the box, but it can also work with any other IDE or debugger.

You can run a backend plugin and attach a debugger to it, which allows you to set breakpoints and debug your backend plugin directly from your IDE of choice:

1. Go to your plugin's folder.

1. Make sure that your `go.mod` and `grafana-plugin-sdk-go` are at least on `v0.156.0`
   - If not, update it to the latest version:
     ```
     go get -u github.com/grafana/grafana-plugin-sdk-go
     ```
1. Build your plugin at least once:
   ```
   yarn build && mage
   ```
1. Install your plugin into your local Grafana instance.

Now that your plugin is ready to run, follow the instructions bellow for your IDE of choice.

### Visual Studio Code

1. If it's not already present, go to your plugin's folder and place the following file inside `.vscode/launch.json`:

   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Standalone debug mode",
         "type": "go",
         "request": "launch",
         "mode": "debug",
         "program": "${workspaceFolder}/pkg",
         "env": {},
         "args": ["-standalone"]
       }
     ]
   }
   ```

1. Press `F5` to run your plugin in debug mode.
1. If Grafana isn't already running, run it.

> If you re-run the configuration, Grafana automatically reloads the plugin.

### GoLand

1. Create a new Run/Debug configuration:

   - **Run kind**: Package
   - **Package path**: your `pkg` package
   - **Program arguments**: `-standalone`

1. Run the config (with or without the debugger).

1. If Grafana isn't already running, run it.

> **Note:** If you re-run the configuration, Grafana  automatically reloads the plugin.

### Other IDEs

Configure your code editor to run the following steps:

1. Build the executable file with debug flags.
   ```
   mage build:debug
   ```
1. Run the plugin's executable file (inside `dist`) with `-standalone -debug` flags.
   ```
   ./gpx_xyz_linux_amd64 -standalone -debug
   ```
1. Attach a debugger to the process.

1. If Grafana isn't already running, run it.

> If you re-run the configuration, Grafana automatically reloads the plugin.

### Notes

- Grafana prints all logs in the plugin's `stdout` rather than in Grafana logs.
- If the backend plugin doesn't serve requests after you turn off debug mode, you can force a reset to the standalone mode. To do so, delete the files `dist/standalone.txt`, `dist/pid.txt`, and  the executable file, and then restart Grafana.
- Grafana doesn't support debugging backend plugins running inside Docker.
