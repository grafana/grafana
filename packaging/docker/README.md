# Grafana Docker image

This topic contains instructions for installing Grafana using the Docker image.

## Run the Grafana Docker container

Start the Docker container by binding Grafana to external port `3000`.

```bash
docker run -d --name=grafana -p 3000:3000 grafana/grafana
```

Try it out, default admin user credentials are admin/admin.

Further documentation can be found at http://docs.grafana.org/installation/docker/.

## Changelog

### v6.4.0-pre1

* Switched base image from Ubuntu:18.04 to Alpine:3.10.

### v6.3.0-beta2
* Switched base image from Ubuntu:latest to Ubuntu:18.04.

### v6.3.0-beta1
* Switched base image to Ubuntu:latest from Debian:stretch to avoid security issues.

### v5.4.3
* Added ability to build and publish Docker images for armv7 and arm64, #14617, thx @johanneswuerbach.

### v5.3.2
* Added Curl back into the Docker image for utility, #13794.

### v5.3.0-beta1
* Made it possible to set a specific plugin URL, #12861, thx ClementGautier.

### v5.1.5, v5.2.0-beta2
* Fixed: config keys ending with _FILE are not respected [#170](https://github.com/grafana/grafana-docker/issues/170).

### v5.2.0-beta1
* Added support for Docker secrets.

### v5.1.0
* Major restructuring of the container.
* Removed usage of `chown`.
* Fixed file permissions incompatibility with previous versions.
  * user id changed from 104 to 472.
  * group id changed from 107 to 472.
* Runs as the Grafana user by default (instead of root).
* Removed all default volumes.

### v4.2.0
* Plugins are now installed into ${GF_PATHS_PLUGINS}.
* Building the container now requires a full URL to the Debian package instead of just the version.
* Fixed bug caused by installing multiple plugins.

### v4.0.0-beta2
* Plugins dir (`/var/lib/grafana/plugins`) is no longer a separate volume.

### v3.1.1
* Made it possible to install specific plugin version https://github.com/grafana/grafana-docker/issues/59#issuecomment-260584026.
