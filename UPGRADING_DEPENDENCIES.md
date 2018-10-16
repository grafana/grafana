# Guide to Upgrading Dependencies

## Files/projects of interest

- `.circleci/config.yml`
- `appveyor.yml`
- `package.json`
- `README.md`

### build-container

The main build step (in CircleCI) is built using a custom build container that comes pre-baked with some of the neccesary dependencies.

Link: [grafana-build-container](https://github.com/grafana/grafana-build-container)

#### Dependencies

- fpm
- nodejs
- golang