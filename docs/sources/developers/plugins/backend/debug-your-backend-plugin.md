+++
title = "Debug your backend plugin"
keywords = ["grafana", "plugins", "backend", "plugin", "backend-plugins", "documentation"]
type = "docs"
+++

# Debug your backend plugin

This guide explains how to attach a debugger to a running backend plugin.

A backend plugin runs in its own process, separate from grafana-server. This makes it difficult to debug the plugin the same way you would debug the grafana-server process.

You can read more about the how plugin processes are managed in the [go-plugin](https://github.com/hashicorp/go-plugin#architecture) project page.

Fortunately, you can debug your plugin by attaching the [Delve](https://github.com/go-delve/delve) debugger for Go to the subprocess running your plugin.

You can add more information available while debugging by building your plugin with additional flags.

1. Disable compiler optimizations and inlining by adding `-gcflags=all="-N -l"` when you build your plugin.

   ```
   go build -gcflags=all="-N -l" -o ./dist/my-datasource_linux_amd64 ./backend
   ```

1. Restart grafana-server or kill running plugin instance to restart plugin.

   ```
   pkill my-datasource
   ```

1. Attach to plugin process.

   ```
   dlv attach <pid>
   ```

## Run Delve in headless mode

1. Get the ID for the process running your plugin.

   ```
   pgrep my-datasource
   ```

1. Run Delve in headless mode. Delve listens on port 3222.

   ```
   dlv attach <pid> --headless --listen=:3222 --api-version 2 --log
   ```

Once Delve is running in the background, you can connect to it from your IDE.

To connect to Delve from [VS Code](https://code.visualstudio.com/), follow the instructions in [Debuggin](https://code.visualstudio.com/docs/editor/debugging) and use the following `launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug backend plugin",
      "type": "go",
      "request": "attach",
      "mode": "remote",
      "port": 3222,
      "host": "127.0.0.1",
    },
  ]
}
```
