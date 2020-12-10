# grafana-build-container

These are the sources for the Docker image that we use for the Grafana build containers. The image source itself
is in Dockerfile, but there are supporting scripts such as the Makefile, for building images.

The image is based on Debian Stretch, since we want an older Linux distribution (Stretch has long-term support into
2022) to build binaries that are as portable as possible.

## Makefile targets

- `make run-with-local-source-copy`
  - Starts the container locally and copies your local sources into the container
- `make run-with-local-source-live`
  - Starts the container (as your user) locally and maps your Grafana project dir into the container
- `make update-source`
  - Updates the sources in the container from your local sources
- `make stop`
  - Kills the container
- `make attach`
  - Opens bash within the running container

## Build/Publish Docker Image
In order to build and publish the Grafana build Docker image, execute the following:

```
# Download MacOSX10.15.sdk.tar.xz from our private GCS bucket into this directory
./build-deploy.sh
```
