# Grafana frontend packages

This document contains information about Grafana frontend package versioning and releases.

## Versioning
We use [Lerna](https://github.com/lerna/lerna) for packages versioning and releases.

All packages are versioned according to the current Grafana version:
- Grafana v6.3.0-alpha1 -> @grafana/* packages @ 6.3.0-alpha.1
- Grafana v6.2.5 -> @grafana/* packages @ 6.2.5
- Grafana - master branch version (based on package.json, i.e. 6.4.0-pre) -> @grafana/* packages @ 6.4.0-pre-<COMMIT-SHA> (see details below about packages publishing channels)

> Please note that @grafana/toolkit, @grafana/ui, @grafana/data, and @grafana/runtime packages are considered ALPHA even though they are not released as alpha versions.

### Stable releases
> **Even though packages are released under a stable version, they are considered ALPHA until further notice!**

Stable releases are published under the `latest` tag on npm. If there was alpha/beta version released previously, the `next` tag is updated to stable version.

### Alpha and beta releases
Alpha and beta releases are published under the `next` tag on npm.

### Automatic prereleases
Every commit to master that has changes within the `packages` directory is a subject of npm packages release. *ALL* packages must be released under version from lerna.json file with commit SHA added to it:

```
<lerna.json version>-<COMMIT_SHA>
```

Automatic prereleases are published under the `canary` dist tag.

### Manual release

> All of the steps below must be performed on a release branch, according to Grafana Release Guide.

> Make sure you are logged in to npm in your terminal and that you are a part of Grafana org on npm.

1. Run `yarn packages:prepare` script from the root directory. This performs tests on the packages and prompts for the version of the packages. The version should be the same as the one being released.
   - Make sure you use semver convention. So, *place a dot between prerelease id and prerelease number*, i.e. 6.3.0-alpha.1
   - Make sure you confirm the version bump when prompted!
2. Commit changes (lerna.json and package.json files) - *"Packages version update: \<VERSION\>"*
3. Run `yarn packages:build` script that prepares distribution packages in `packages/grafana-*/dist`. These directories are going to be published to npm.
4. Depending whether or not it's a prerelease:
   - When releasing a prerelease run `packages:publishNext` to publish new versions.
   - When releasing a stable version run `packages:publishLatest` to publish new versions.

5. Push version commit to the release branch.

### Building individual packages
To build individual packages, run:

```
grafana-toolkit package:build --scope=<ui|toolkit|runtime|data>
```
