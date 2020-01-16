+++
title = "Build custom Grafana Docker image"
description = "Guide for building a custom the Grafana Docker image"
keywords = ["grafana", "configuration", "documentation", "docker"]
type = "docs"
[menu.docs]
name = "Build a custom Grafana Docker image"
identifier = "docker"
parent = "administration"
weight = 660
+++

# Build a custom Grafana Docker image

After you [install a Grafana Docker image](docker.md) and [configure your Grafana Docker image](configure-docker.md), you can build your own customized image. This saves time if you are creating multiple images and you want them all to have the same plugins installed on build.

In the [Grafana GitHub repository](https://github.com/grafana/grafana/tree/master/packaging/docker) there is a folder called `custom/` which two includes Dockerfiles, `Dockerfile` and `ubuntu.Dockerfile`, that can be used to build a custom Grafana image. It accepts `GRAFANA_VERSION`, `GF_INSTALL_PLUGINS` and `GF_INSTALL_IMAGE_RENDERER_PLUGIN` as build arguments.

## Build with pre-installed plugins

> If you need to specify the version of a plugin, you can add it to the `GF_INSTALL_PLUGINS` build argument. Otherwise, the latest will be assumed. For example: `--build-arg "GF_INSTALL_PLUGINS=grafana-clock-panel 1.0.1,grafana-simple-json-datasource 1.3.5"`

Example of how to build and run:
```bash
cd custom
docker build \
--build-arg "GRAFANA_VERSION=latest" \
--build-arg "GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource" \
-t grafana-custom -f Dockerfile .

docker run -d -p 3000:3000 --name=grafana grafana-custom
```

Replace `Dockerfile` in above example with `ubuntu.Dockerfile` to build a custom Ubuntu based image (Grafana 6.5+).

## Build with Grafana Image Renderer plugin pre-installed

> Only available in Grafana v6.5 and later. This is experimental.

The [Grafana Image Renderer plugin]({{< relref "../administration/image_rendering/#grafana-image-renderer-plugin" >}}) does not currently work if it is installed in Grafana Docker image. You can build a custom Docker image by using the `GF_INSTALL_IMAGE_RENDERER_PLUGIN` build argument. This installs additional dependencies needed for the Grafana Image Renderer plugin to run.

Example of how to build and run:
```bash
cd custom
docker build \
--build-arg "GRAFANA_VERSION=latest" \
--build-arg "GF_INSTALL_IMAGE_RENDERER_PLUGIN=true" \
-t grafana-custom -f Dockerfile .

docker run -d -p 3000:3000 --name=grafana grafana-custom
```

Replace `Dockerfile` in above example with `ubuntu.Dockerfile` to build a custom Ubuntu-based image.
