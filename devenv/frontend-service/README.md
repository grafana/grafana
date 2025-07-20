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

### Bootdata unavailable

To simulate the `/bootdata` being unavailable, visit the url `/-/down` in your browser. This will set a cookie that the proxy uses to return the 503 for a default of 5 minutes. To set a custom duration, visit `/-/down/:seconds`. Visit `/-/up` to remove the cookie and restore the endpoint.
