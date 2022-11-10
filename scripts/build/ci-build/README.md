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

If running on an ARM chip (Apple M1/M2, etc.), be sure to add `--platform linux/amd64` to the `docker build` command and prepare for this to take a while (~4 hours for an initial build, faster thereafter due to caching)
