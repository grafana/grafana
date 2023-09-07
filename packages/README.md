# Grafana frontend packages

This document contains information about Grafana frontend package versioning and releases.

## Versioning

We use [Lerna](https://github.com/lerna/lerna) for packages versioning and releases.

All packages are versioned according to the current Grafana version:

- Grafana v6.3.0-alpha1 -> @grafana/\* packages @ 6.3.0-alpha.1
- Grafana v6.2.5 -> @grafana/\* packages @ 6.2.5
- Grafana - main branch version (based on package.json, i.e. 6.4.0-pre) -> @grafana/\* packages @ 6.4.0-pre-<COMMIT-SHA> (see details below about packages publishing channels)

> Please note that @grafana/ui, @grafana/data, and @grafana/runtime packages are considered ALPHA even though they are not released as alpha versions.

### Stable releases

> **Even though packages are released under a stable version, they are considered ALPHA until further notice!**

Stable releases are published under the `latest` tag on npm. If there was alpha/beta version released previously, the `next` tag is updated to stable version.

### Alpha and beta releases

Alpha and beta releases are published under the `next` tag on npm.

### Automatic prereleases

Every commit to main that has changes within the `packages` directory is a subject of npm packages release. _ALL_ packages must be released under version from lerna.json file with the drone build number added to it:

```
<lerna.json version>-<DRONE_BUILD_NUMBER>
```

### Manual release

> All of the steps below must be performed on a release branch, according to Grafana Release Guide.

> You must be logged in to NPM as part of Grafana NPM org before attempting to publish to the npm registery.

1. Run `yarn packages:clean` script from the root directory. This will delete any previous builds of the packages.
2. Run `yarn packages:prepare` script from the root directory. This performs tests on the packages and prompts for the version of the packages. The version should be the same as the one being released.
   - Make sure you use semver convention. So, _place a dot between prerelease id and prerelease number_, i.e. 6.3.0-alpha.1
   - Make sure you confirm the version bump when prompted!
3. Run `yarn packages:build` script that compiles distribution code in `packages/grafana-*/dist`.
4. Run `yarn packages:pack` script to compress each package into `npm-artifacts/*.tgz` files. This is required for yarn to replace properties in the package.json files declared in the `publishConfig` property.
5. Depending on whether or not it's a prerelease:

   - When releasing a prerelease run `./scripts/publish-npm-packages.sh --dist-tag 'next' --registry 'https://registry.npmjs.org/'` to publish new versions.
   - When releasing a stable version run `./scripts/publish-npm-packages.sh --dist-tag 'latest' --registry 'https://registry.npmjs.org/'` to publish new versions.
   - When releasing a test version run `./scripts/publish-npm-packages.sh --dist-tag 'test' --registry 'https://registry.npmjs.org/'` to publish test versions.

6. Revert any changes made by the `packages:prepare` script.

### Building individual packages

To build individual packages, run:

```
yarn packages:build --scope=@grafana/<data|e2e|e2e-selectors|runtime|schema|ui>
```

### Setting up @grafana/\* packages for local development

A known issue with @grafana/\* packages is that a lot of times we discover problems on canary channel(see [versioning overview](#Versioning)) when the version was already pushed to npm.

We can easily avoid that by setting up a local packages registry and test the packages before actually publishing to npm.

In this guide you will set up [Verdaccio](https://verdaccio.org/) registry locally to fake npm registry. This will enable testing @grafana/\* packages without the need for pushing to main.

#### Setting up local npm registry

From your terminal:

1. Navigate to `devenv/local-npm` directory.
2. Run `docker-compose up`. This will start your local npm registry, available at http://localhost:4873/.
3. To test `@grafana` packages published to your local npm registry uncomment `npmScopes` and `unsafeHttpWhitelist` properties in the `.yarnrc` file.

#### Publishing packages to local npm registry

You need to follow [manual packages release procedure](#manual-release). The only difference is the last command in order to publish to you local registry.

From your terminal:

1. Run `yarn packages:clean`.
2. Run `yarn packages:prepare`.
3. Run `yarn packages:build`.
4. Run `yarn packages:pack`.
5. Run `NPM_TOKEN=NONE ./scripts/publish-npm-packages.sh`.
6. Navigate to http://localhost:4873 and verify the version was published

Locally published packages will be published under `dev` or `canary` channel, so in your plugin package.json file you can use that channel. For example:

```
// plugin's package.json

dependencies: {
  //... other dependencies
  "@grafana/data": "dev" // or canary
}
```

or you can instruct npm to install directly the specific version you published.

#### Using your local package in another package (e.g. a plugin)

To use your local published package in another package you'll have to create an `.npmrc` file in that repository and add the following line:

```
@grafana:registry=http://localhost:4873/
```

Make sure there is no other line already defined for `@grafana`.
