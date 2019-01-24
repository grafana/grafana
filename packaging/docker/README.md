# Grafana Docker image

## Running your Grafana container

Start your container binding the external port `3000`.

```bash
docker run -d --name=grafana -p 3000:3000 grafana/grafana
```

Try it out, default admin user is admin/admin.

## How to use the container

Further documentation can be found at http://docs.grafana.org/installation/docker/

## Changelog

### v5.1.5, v5.2.0-beta2
* Fix: config keys ending with _FILE are not respected [#170](https://github.com/grafana/grafana-docker/issues/170)

### v5.2.0-beta1
* Support for Docker Secrets

### v5.1.0
* Major restructuring of the container
* Usage of `chown` removed
* File permissions incompatibility with previous versions
  * user id changed from 104 to 472
  * group id changed from 107 to 472
* Runs as the grafana user by default (instead of root)
* All default volumes removed

### v4.2.0
* Plugins are now installed into ${GF_PATHS_PLUGINS}
* Building the container now requires a full url to the deb package instead of just version
* Fixes bug caused by installing multiple plugins

### v4.0.0-beta2
* Plugins dir (`/var/lib/grafana/plugins`) is no longer a separate volume

### v3.1.1
* Make it possible to install specific plugin version https://github.com/grafana/grafana-docker/issues/59#issuecomment-260584026
