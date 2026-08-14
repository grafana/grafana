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

### v9.0.3

- Upgraded glibc version to glibc [2.35](https://sourceware.org/pipermail/libc-alpha/2022-February/136040.html) [#51107](https://github.com/grafana/grafana/pull/51107/files)

### v8.3.0-beta2

- Our Alpine based images have been upgraded to Alpine [3.14.3](https://alpinelinux.org/posts/Alpine-3.14.3-released.html) [#41922](https://github.com/grafana/grafana/pull/41922) [@hairyhenderson](https://github.com/hairyhenderson)
- Our Go build image has been upgraded to Go [1.17.2](https://golang.org/doc/devel/release#go1.17.minor) [#41922](https://github.com/grafana/grafana/pull/41922) [@hairyhenderson](https://github.com/hairyhenderson)

### v8.2.6

- **Security:** Upgrade Alpine based images to [3.14.3](https://alpinelinux.org/posts/Alpine-3.14.3-released.html). [#42061](https://github.com/grafana/grafana/pull/42061), [@dsotirakis](https://github.com/dsotirakis)
- **Security:** Upgrade Go to [1.17.2](https://go.dev/doc/devel/release#go1.17.minor). [#42427](https://github.com/grafana/grafana/pull/42427), [@idafurjes](https://github.com/idafurjes)

### v7.3.0-beta1

- OpenShift compatibility. [#27813](https://github.com/grafana/grafana/pull/27813), [@xlson](https://github.com/grafana/grafana/pull/27813)

### v7.0.0-beta3

- Our Alpine based images have been upgraded to Alpine [3.11](https://www.alpinelinux.org/posts/Alpine-3.11.0-released.html)

### v7.0.0-beta1

- Our Ubuntu based images have been upgraded to Ubuntu [20.04 LTS](https://releases.ubuntu.com/20.04/)

### v6.5.0-beta1

- Build and publish an additional Ubuntu based docker image. [#20196](https://github.com/grafana/grafana/pull/20196), [@aknuds1](https://github.com/aknuds1)
- Build and use musl-based binaries in alpine images to resolve glibc incompatibility issues. [#19798](https://github.com/grafana/grafana/pull/19798), [@aknuds1](https://github.com/aknuds1)
- Add additional glibc dependencies to support certain backend plugins in alpine. [#20214](https://github.com/grafana/grafana/pull/20214), [@briangann](https://github.com/briangann)

### v6.4.0-beta1

- Switched base image from Ubuntu:18.04 to Alpine:3.10.

### v6.3.0-beta2

- Switched base image from Ubuntu:latest to Ubuntu:18.04.

### v6.3.0-beta1

- Switched base image to Ubuntu:latest from Debian:stretch to avoid security issues.

### v5.4.3

- Added ability to build and publish Docker images for armv7 and arm64, #14617, thx @johanneswuerbach.

### v5.3.2

- Added Curl back into the Docker image for utility, #13794.

### v5.3.0-beta1

- Made it possible to set a specific plugin URL, #12861, thx ClementGautier.

### v5.1.5, v5.2.0-beta2

- Fixed: config keys ending with \_FILE are not respected [#170](https://github.com/grafana/grafana-docker/issues/170).

### v5.2.0-beta1

- Added support for Docker secrets.

### v5.1.0

- Major restructuring of the container.
- Removed usage of `chown`.
- Fixed file permissions incompatibility with previous versions.
  - user id changed from 104 to 472.
  - group id changed from 107 to 472.
- Runs as the Grafana user by default (instead of root).
- Removed all default volumes.

### v4.2.0

- Plugins are now installed into ${GF_PATHS_PLUGINS}.
- Building the container now requires a full URL to the Debian package instead of just the version.
- Fixed bug caused by installing multiple plugins.

### v4.0.0-beta2

- Plugins dir (`/var/lib/grafana/plugins`) is no longer a separate volume.

### v3.1.1

- Made it possible to install specific plugin version https://github.com/grafana/grafana-docker/issues/59#issuecomment-260584026.
