## Grafana frontend packages

## Versioning
We use [Lerna](https://github.com/lerna/lerna) for packages versioning and releases

All packages are versioned according to the current Grafana version:
- Grafana v6.3.0-alpha1 -> @grafana/* packages @ 6.3.0-alpha.1
- Grafana v6.2.5 -> @grafana/* packages @ 6.2.5
- Grafana - master branch version (based on package.json, i.e. 6.4.0-pre) -> @grafana/* packages @ 6.4.0-pre-<COMMIT-SHA> (see details below about packages publishing channels)

> Please note that @grafana/toolkit, @grafana/ui, @grafana/data & @grafana/runtime packages are considered ALPHA even though they are not released as alpha versions

### Stable releases
> **Even though packages are released under a stable version, they are considered ALPHA until further notice!**

Stable releases are published under `latest` tag on npm.

### Alpha and beta releases
Alpha and beta releases are published under `next` tag on npm.

### Automatic pre-releases
Every commit to master that has changes within `packages` directory is a subject of npm packages release.
*ALL* packages will be released under version from lerna.json file with commit SHA added to it:

```
<lerna.json version>-<COMMIT_SHA>
```

Automatic prereleases are published under `canary` dist tag.

### Manual release
> **Checkout** to the tag you are about to release first, i.e. `git checkout v6.4.0`

> Make sure **you are logged in to npm** in your terminal and that **you are a part of Grafana org on npm**

In Grafana's repo main directory **run**:

```
./scripts/build/release-packages.sh <VERSION>
```

where `<VERSION>` is the same as the version tag, i.e. `v6.4.0`


### Building individual packages
To build induvidual packages run `grafana-toolkit package:build --scope=<ui|toolkit|runtime|data>`


