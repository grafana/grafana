---
title: Development with local Grafana
---

# Development with local Grafana

This guide allows you to setup a development environment where you run Grafana and your plugin locally. With this, you will be able to see your changes as you add them.

## Run Grafana in your host

If you have git, Go and the required version of NodeJS in your system, you can clone and run Grafana locally:

1. Download and set up Grafana. You can find instructions on how to do it in the [developer-guide](https://github.com/grafana/grafana/blob/HEAD/contribute/developer-guide.md).

2. Grafana will look for plugins, by default, on its `data/plugins` directory. You can create a symbolic link to your plugin repository to detect new changes:

   ```bash
   ln -s <plugin-path>/dist data/plugins/<plugin-name>
   ```

3. (Optional) If the step above doesn't work for you (e.g. you are running on Windows), you can also modify the default path in the Grafana configuration (that can be found at `conf/custom.ini`) and point to the directory with your plugin:

   ```ini
   [paths]
   plugins = <path-to-your-plugin-parent-directory>
   ```

## Run Grafana with docker-compose

Another possibility is to run Grafana with docker-compose so it runs in a container. For doing so, create the docker-compose file in your plugin directory:

**NOTE**: Some plugins already include a docker-compose file so you can skip this step.

```yaml
version: '3.7'

services:
  grafana:
    # Change latest with your target version, if needed
    image: grafana/grafana:latest
    ports:
      - 3000:3000/tcp
    volumes:
      # Use your plugin folder (e.g. redshift-datasource)
      - ./dist:/var/lib/grafana/plugins/<plugin-folder>
      - ./provisioning:/etc/grafana/provisioning
    environment:
      - TERM=linux
      - GF_LOG_LEVEL=debug
      - GF_DATAPROXY_LOGGING=true
      - GF_DEFAULT_APP_MODE=development
```

## Run your plugin

Finally start your plugin in development mode. Go to your plugin root directory and follow these steps:

1. Build your plugin backend and start the frontend in watch mode:

   ```bash
   mage -v
   yarn watch
   ```

2. Start Grafana backend and frontend:

   2.1 For a local copy of Grafana, go to the directory with Grafana source code and run:

   ```bash
   make run
   ```

   ```bash
   yarn start
   ```

   2.2 Or with docker-compose, in your plugin directory, run:

   ```bash
   docker-compose up
   ```

After this, you should be able to see your plugin listed in Grafana and test your changes. Note that any change in the fronted will require you to refresh your browser while changes in the backend may require to rebuild your plugin binaries and reload the plugin (`mage && mage reloadPlugin` for local development or `docker-compose up` again if you are using docker-compose).

## Run your backend plugin with a debugger

> Note: The following method only works with a local Grafana instance and currently doesn't work with Docker.

You can run a backend plugin and attach a debugger to it, which allows you to set breakpoints and debug your backend plugin directly from your IDE of choice.

We support Visual Studio Code and GoLand out of the box, but this feature can also work with any other IDE or debugger.

1. Go to your plugin's folder.

1. Check your `go.mod` and make sure `grafana-plugin-sdk-go` is at least on `v0.156.0`
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
1. Start Grafana, if it's not already running.

> If you re-run the configuration, Grafana will automatically reload the plugin.

### GoLand

1. Create a new Run/Debug configuration:

   - **Run kind**: Package
   - **Package path**: your `pkg` package
   - **Program arguments**: `-standalone`

1. Run the config (with or without the debugger).

1. Start Grafana, if it's not already running.

> If you re-run the configuration, Grafana will automatically reload the plugin.

### Other IDEs

Configure your code editor to run the following steps:

1. Build the executable with debug flags.
   ```
   mage build:debug
   ```
1. Run the plugin's executable (inside `dist`) with `-standalone -debug` flags.
   ```
   ./gpx_xyz_linux_amd64 -standalone -debug
   ```
1. Attach a debugger to the process.

Then, you can start Grafana, if it's not already running.

> If you re-run the configuration, Grafana will automatically reload the plugin.

### Notes

- All logs are printed in the plugin's `stdout` rather than in Grafana logs.
- If the backend plugin doesn't serve requests after turning off debug mode, you can force reset the standalone mode. To do so, delete the files `dist/standalone.txt` and `dist/pid.txt` alongside the executable file, and then restart Grafana.
- We currently do not support debugging backend plugins running inside Docker.
