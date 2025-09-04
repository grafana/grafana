# frontend-service local dev

This directory contains a docker compose + Tilt setup for running a full frontend service stack locally. It contains:

- frontend-service
- backend api
- static asset cdn.

## Getting started

On top of the main Grafana development dependencies, you will need installed:

- [Docker](https://docs.docker.com/get-started/get-docker/)
- [Tilt](https://docs.tilt.dev/install.html). At the moment we're not using Kubernetes locally, so you shouldn't need to follow the instructions to install kubectl or kind.

To start the stack, from the root of the Grafana project run `make frontend-service-up`. Tilt will orchestrate the webpack and docker builds, and then run the services with Docker compose. You can monitor it's progress and see logs with the URL to the Tilt console. Once done, you can access Grafana at `http://localhost:3000`.

Quitting the process will not stop the service from running. Run `make frontend-service-down` when done to shut down the docker containers.

### Grafana config

The Grafana API and frontend-service containers are configured in two places:

- `GF_` environment variables in the docker-compose file. Config specific to this development stack, that should be the same for everyone, is set here.

- `configs/{frontend-service,grafana-api}.local.ini` file is where you can set your own personal config values, such as feature toggles. This file is git-ignored.

### Bootdata unavailable

To simulate the `/bootdata` endpoint being available, there are special control URLs you can visit that use cookies to control behaviour:

- `/-/down` - Simulates the endpoint being unavailable for 60 seconds.
- `/-/down/:seconds` - Simulates the endpoint being unavailable for a custom number of seconds.
- `/-/up` - Restores the endpoint to being available.

When unavailable, the API will return `HTTP 503 Service Unavailable` with a JSON payload.

### Leave service running

By default, Tilt services stay running after you close the CLI, but `make frontend-service` wraps Tilt and auto shuts down the services. Set the environment variable `AUTO_DOWN=false` when running `make frontend-service` to leave the services running after quitting make. This is useful if you're restarting tilt often in quick succession for developing it.
