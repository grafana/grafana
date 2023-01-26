# grafana-build-container

These are the sources for the Docker image that we use for the Grafana build containers. The image source itself
is in Dockerfile, but there are supporting scripts such as the Makefile, for building images.

The image is based on Debian Buster, since we want an older Linux distribution (Buster has long-term support into 2024) to build binaries that are as portable as possible.

## Build/Publish Docker Image

In order to build and publish the Grafana build Docker image, execute the following:

```
# Download MacOSX10.15.sdk.tar.xz from our private GCS bucket into this directory
docker build -t grafana/build-container:<VERSION> .
docker push grafana/build-container:<VERSION>
```

If you're running on a machine that has an ARM chip (Apple M1/M2, etc.), add `--platform linux/amd64` to the `docker build` command. It can take approximately four hours for an initial build to complete. Due to caching, subsequent builds take less time (~10 mins or so).
