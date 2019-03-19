# Grafana UI components library

@grafana/ui is a collection of components used by [Grafana](https://github.com/grafana/grafana)

Our goal is to deliver Grafana's common UI elements for plugins developers and contributors.

See [package source](https://github.com/grafana/grafana/tree/master/packages/grafana-ui) for more details.

## Installation

`yarn add @grafana/ui`

`npm install @grafana/ui`

## Development

For development purposes we suggest using `yarn link` that will create symlink to @grafana/ui lib. To do so navigate to `packages/grafana-ui` and run `yarn link`. Then, navigate to your project and run `yarn link @grafana/ui` to use the linked version of the lib. To unlink follow the same procedure, but use `yarn unlink` instead.

## Building @grafana/ui
To build @grafana/ui run `npm run gui:build` script *from Grafana repository root*. The build will be created in `packages/grafana-ui/dist` directory. Following steps from [Development](#development) you can test built package.

## Releasing new version
To release new version run `npm run gui:release` script *from Grafana repository root*. The script will prepare the distribution package as well as prompt you to bump library version and publish it to the NPM registry.

### Automatic version bump
When running `npm run gui:release` package.json file will be automatically updated. Also, package.json file will be commited and pushed to upstream branch.

### Manual version bump
To use `package.json` defined version run `npm run gui:release --usePackageJsonVersion` *from Grafana repository root*.

### Preparing release package without publishing to NPM registry
For testing purposes there is `npm run gui:releasePrepare` task that prepares distribution package without publishing it to the NPM registry.

### V1 release process overview
1. Package is compiled with TSC. Typings are created in `/dist` directory, and the compiled js lands in `/compiled` dir
2. Rollup creates a CommonJS package based on compiled sources, and outputs it to `/dist` directory
3. Readme, changelog and index.js files are moved to `/dist` directory
4. Package version is bumped in both `@grafana/ui` package dir and in dist directory.
5. Version commit is created and pushed to master branch
5. Package is published to npm


## Versioning
To limit the confusion related to @grafana/ui and Grafana versioning we decided to keep the major version in sync between those two.
This means, that first version of @grafana/ui is taged with 6.0.0-alpha.0 to keep version in sync with Grafana 6.0 release.


