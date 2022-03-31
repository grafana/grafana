+++
title = "Development with local Grafana"
+++

# Development with local Grafana

This guide allows you to setup a development environment where you run Grafana and your plugin locally. With this, you will be able to see your changes as you add them.

## Run Grafana in your host

If you have git, Go and the required version of NodeJS in your system, you can clone and run Grafana locally:

1. Clone [Grafana](https://github.com/grafana/grafana)

   a. [optional] Checkout to the specific version you want to target (e.g. `git checkout v8.3.4`)

2. Install its dependencies

   ```bash
   yarn install
   ```

3. Grafana will look for plugins, by default, on its `data/plugins` directory. You can create a symbolic link to your plugin repository to detect new changes:

   ```bash
   ln -s <plugin-path>/dist data/plugins/<plugin-name>
   ```

4. (Optional) If the step above doesn't work for you (e.g. you are running on Windows), you can also modify the default path in the Grafana configuration (that can be found at `conf/custom.ini`) and point to the directory with your plugin:

   ```ini
   [paths]
   plugins = <path-to-your-plugin-parent-directory>
   ```

## Run Grafana with docker-compose

Another possibility is to run Grafana with docker-compose so it runs in a container. For doing so, create the docker-compose file in your plugin directory:

```yaml
version: '3.7'

services:
  grafana:
    # Change latest with your target version, if needed
    image: grafana/grafana:latest
    ports:
      - '3000:3000'
    volumes:
      # Use your plugin folder (e.g. redshift-datasource)
      - ./:/var/lib/grafana/plugins/<plugin-folder>
    environment:
      - TERM=linux
      - GF_LOG_LEVEL=debug
      - GF_DATAPROXY_LOGGING=true
      # Use your plugin name (e.g. grafana-redshift-datasource)
      - GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=<plugin-name>
```

## Run your plugin

Finally start your plugin in development mode:

1. Build your plugin backend and start the frontend in watch mode:

   ```bash
   mage -v
   yarn watch
   ```

2. Start Grafana backend and frontend:

   2.1 For a local copy of Grafana:

   ```bash
   make run
   ```

   ```bash
   yarn start
   ```

   2.2 For docker-compose:

   ```bash
   docker-compose up
   ```

After this, you should be able to see your plugin listed in Grafana and test your changes. Note that any change in the fronted will require you to refresh your browser while changes in the backend may require to rebuild your plugin binaries and reload the plugin (`mage && mage reloadPlugin` for local development or `docker-compose up` again if you are using docker-compose).
