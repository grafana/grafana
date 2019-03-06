# Grafana UI components library

@grafana/ui is a collection of components used by [Grafana](https://github.com/grafana/grafana)

Our goal is to deliver Grafana's common UI elements for plugins developers and contributors.

See [package source](https://github.com/grafana/grafana/tree/master/packages/grafana-ui) for more details.

## Installation

`yarn add @grafana/ui`

`npm install @grafana/ui`]

## Development

For development purposes we suggest using `yarn link` that will symlink @grafana/ui to your project. To do so navigate to `packages/grafana-ui` and run `yarn link`. Then, navigate to your project and run `yarn link @grafana/ui` to use linked version of the lib. To unlink follow the same procedure but use `yarn unlink`.


## Building @grafana/ui
To build @grafana/ui `npm run gui:build` script from Grafana repository root. The build will be created in `packages/grafana-ui/dist` directory. Following steps from [Development](#development) you can test built package.

## Releasing new version
To release new version run `npm run gui:release` script from Grafana repository root. The script will prepare distribution package as well as allow you to bump library version and publish new version to NPM registry.

### Automatic version bump
When running `npm run gui:release` script package.json file will be automatically updated. You need to commit this file to the repository to make sure version is updated.

### Manual version bump
To use `package.json` defined version run `npm run gui:release --usePackageJsonVersion` from Grafana repository root.

### Preparing release package without publishing to NPM registry
For testing purposes there is `npm run gui:releasePrepare` task that prepares distribution package without publishing it to the NPM registry.


## Versioning
To limit the confusion related to @grafana/ui and Grafana versioning we decided to keep the major version in sync between those two.
This means, that first version of @grafana/ui is taged with 6.0.0-alpha.0 to keep version in sync with Grafana 6.0 release.


