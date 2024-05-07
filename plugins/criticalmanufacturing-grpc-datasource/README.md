# Critical Manufacturing - Grafana Data Source Plugin

[![Build](https://github.com/grafana/grafana-starter-datasource/workflows/CI/badge.svg)](https://github.com/grafana/grafana-starter-datasource/actions?query=workflow%3A%22CI%22)

## Getting started

Pre-requirements:

- **mage**: Required to compile the plugin backend (https://magefile.org/)

  - To compile in verbose mode just run: 

    ```powershell
    mage -v
    ```

    If you only want to compile for an OS just run: 

    ```powershell
    mage -v build:windows
    ```

    

- **protoc**: Required to generate the source code in GO from the proto file (if no change is done to the proto file, this is not required)

  - As an example for this particular plugin: 

    ```powershell
    protoc --go_out=. --go_opt=paths=source_relative --go-grpc_out=. --go-grpc_opt=paths=source_relative .\pkg\proto\DataManager.proto
    ```

    

- **nvm**: ~~This is useful if you require multiple versions of node (for windows, please use: https://github.com/coreybutler/nvm-windows), since our MES GUIs are currently using version 10 and this project requires version 14 you will need this.~~ This is no longer needed, since our MES GUIs can be compiled with node version 14 as well.

  

1. Install dependencies

   ```powershell
   yarn install
   ```

2. Build plugin in development mode or run in watch mode

   ```powershell
   yarn dev
   ```

   or

   ```powershell
   yarn watch
   ```

3. Build plugin backend

   ```powershell
   mage -v
   ```

4. Build plugin in production mode

   ```powershell
   yarn build
   ```

   Build plugin in production mode



## Debug

To debug the frontend part of the plugin you just need to use the Developer Tools in your browser.

For the backend plugin a little more work is required.

We first need to build the backend with more debug information

Example for Windows:

```powershell
go build -gcflags=all="-N -l" -o ..\dist\cmf_backend_grpc_plugin_windows_amd64.exe
```

Next, we need to start delve, a debugger for the go language using the command:

```powershell
dlv attach $procid --headless --listen=:$port --api-version 2 --log
```

A script was created to ease the debugging process in Windows (debug-backend.ps1).

We will create a similar script for containers.

To debug using VS Code, you will need to create a launch.json file in the directory 

```c#
.\Research\Grafana\plugin\criticalmanufacturing-grpc-datasource\pkg\.vscode
```

With the following content

```json
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
          "name": "Debug backend plugin",
          "type": "go",
          "request": "attach",
          "mode": "remote",
          "port": 633,
          "host": "127.0.0.1",
        },
    ]
}
```

## Scripts

### Build and Copy

The buildandcopy.ps1 accepts up to three flags:
- **-p** will compile the proto files in the proto folder (protoc --go_out=..\..\Grafana\plugins\criticalmanufacturing-grpc-datasource\pkg\proto --go_opt=paths=source_relative --go-grpc_out=..\..\Grafana\plugins\criticalmanufacturing-grpc-datasource\pkg\proto --go-grpc_opt=paths=source_relative .\DataManager.proto);
- **-b** will compile the plugin backend for every OS/Architecture with verbose enabled (mage -v);
- **-f** will compile the plugin frontend (yarn build).

Regardless of the flags, at the end of the script, all the relevant files will be copied to the Windows Grafana installation default path (C:\Program Files\GrafanaLabs\grafana\data\plugins\criticalmanufacturing-grpc-datasource).


## Reading material

- [Build a data source plugin tutorial](https://grafana.com/tutorials/build-a-data-source-plugin)
- [Grafana documentation](https://grafana.com/docs/)
- [Grafana Tutorials](https://grafana.com/tutorials/) - Grafana Tutorials are step-by-step guides that help you make the most of Grafana
- [Grafana UI Library](https://developers.grafana.com/ui) - UI components to help you build interfaces using Grafana Design System
