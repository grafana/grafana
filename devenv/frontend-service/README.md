# frontend-service local dev

This directory contains a docker compose + Tilt setup for running a full frontend service stack locally. It contains:

 - frontend-service
 - backend api
 - static asset cdn.

## Getting started

On top of the main Grafana development dependencies, you will need installed:

 - [Docker](https://docs.docker.com/get-started/get-docker/)
 - [Tilt](https://docs.tilt.dev/install.html). At the moment we're not using Kubernetes locally, so you shouldn't need to follow the instructions to install kubectl or kind.
 - [Zig](https://ziglang.org/download/). Required on macOS for cross-OS builds.

To start the stack, from the root of the Grafana project run `make frontend-service-up`. Tilt will orchestrate the webpack and docker builds, and then run the services with Docker compose. You can monitor it's progress and see logs with the URL to the Tilt console. Once done, you can access Grafana at `http://localhost:3000`.

Quitting the process will not stop the service from running. Run `make frontend-service-down` when done to shut down the docker containers.

### macOS

On macOS, where the go binary is build on the host but then copied into the Linux docker container, zig is required for cross-OS CGO_ENABLED=1 builds. If you're not able to install zig, you may be able to run tilt with a special flag that will attempt to build Grafana in a linux docker image instead - YMMV

```
tilt -f devenv/frontend-service -- --docker-builder
```

### Bootdata unavailable

To simulate the `/bootdata` endpoint being available, there are special control URLs you can visit that use cookies to control behaviour:

 - `/-/down` - Simulates the endpoint being unavailable for 60 seconds.
 - `/-/down/:seconds` - Simulates the endpoint being unavailable for a custom number of seconds.
 - `/-/up` - Restores the endpoint to being available.

When unavailable, the API will return `HTTP 503 Service Unavailable` with a JSON payload.
