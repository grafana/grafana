# Grafana frontend packages

## Exporting code conventions

All the `@grafana` packages in this repo (except `@grafana/schema`) make use of `exports` in package.json to define entrypoints that Grafana core and Grafana plugins can access. Exports can also be used to restrict access to internal files in packages.

Package authors are free to create as many exports as they like but should consider the following points:

1. Resolution of source code within this repo is handled by the [customCondition](https://www.typescriptlang.org/tsconfig/#customConditions) `@grafana-app/source`. This allows the frontend tooling in this repo to resolve to the source code preventing the need to build all the packages up front. When adding exports it is important to add an entry for the custom condition as the first item. All other entries should point to the built, bundled files. For example:

   ```json
   "exports": {
     ".": {
       "@grafana-app/source": "./src/index.ts",
       "types": "./dist/types/index.d.ts",
       "import": "./dist/esm/index.mjs",
       "require": "./dist/cjs/index.cjs"
     }
   }
   ```

2. If you add exports to your package you must export the `package.json` file.

3. Before exposing anything in these packages please consider the table below to better understand the conventions we have put in place for most of the packages in this repository.

| Export Name  | Import Path            | Description                                                                                                                                                                                                           | Available to Grafana | Available to plugins |
| ------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------- |
| `./`         | `@grafana/ui`          | The public API entrypoint. If the code is stable and you want to share it everywhere, this is the place to export it.                                                                                                 | ✅                   | ✅                   |
| `./unstable` | `@grafana/ui/unstable` | The public API entrypoint for all experimental code. If you want to iterate and test code from Grafana and plugins, this is the place to export it.                                                                   | ✅                   | ✅                   |
| `./internal` | `@grafana/ui/internal` | The private API entrypoint for internal code shared with Grafana. If you want to co-locate code in a package with it's public API but only want the Grafana application to access it, this is the place to export it. | ✅                   | ❌                   |

## Versioning

We use [Nx Release](https://nx.dev/docs/guides/nx-release) to version packages. The `release` block in `nx.json` defines release groups. The `grafana` group lists the packages that are versioned together with Grafana. `@grafana/plugin-compat` is not in it; it is in its own `plugin-compat` group with an independent version. Commands that version Grafana packages, such as `pnpm packages:prepare`, pass `--groups=grafana` so they never touch the independent group. Do not run `nx release version` without `--groups`: the specifier would be applied to both groups.

All packages in the `grafana` group are versioned according to the current Grafana version:

- Grafana v6.3.0-alpha1 -> @grafana/\* packages @ 6.3.0-alpha.1
- Grafana v6.2.5 -> @grafana/\* packages @ 6.2.5
- Grafana - main branch version (based on package.json, i.e. 6.4.0-pre) -> @grafana/\* packages @ 6.4.0-pre-<COMMIT-SHA> (see details below about packages publishing channels)

> Please note that the @grafana/api-clients package is considered ALPHA even though it is not released as an alpha version.

### Independent packages

Some packages have their own version instead of following the Grafana version. Today that is `@grafana/plugin-compat`. For these packages, the version bump and the `CHANGELOG.md` entry come from the [conventional commit](https://www.conventionalcommits.org/) titles of the pull requests that change the package. Do not edit the `version` field or `CHANGELOG.md` by hand.

A pull request that changes an independent package must have a title of the form `<type>(<scope>): <description>`, where the scope is optional, for example `feat: Add useDataSourceInstanceList` or `fix(plugin-compat): Handle a missing host API`. The `Check plugin-compat pull request title` workflow fails the pull request otherwise. The title becomes the squash-merged commit message that Nx reads, so the description should make sense to consumers.

A breaking change (`feat!: ...`) can have no scope or the scope of the package it changes, such as `plugin-compat` for `@grafana/plugin-compat`. Nx finds the package from the files a pull request changes and drops the breaking marker when the scope is something else, so `feat(datasources)!: ...` would be released as a minor change. The check does not catch this, so stick to those scopes for breaking changes.

Below 1.0 Nx shifts the bump down one level (its [`adjustSemverBumpsForZeroMajorVersion`](https://nx.dev/docs/reference/nx-json) option, on by default), so choose by intent:

| Title        | Use for                         | Released as (example: from 0.10.0) |
| ------------ | ------------------------------- | ---------------------------------- |
| `feat!: ...` | A breaking change for consumers | 0.11.0                             |
| `feat: ...`  | A new feature or export         | 0.10.1                             |
| `fix: ...`   | A bug fix                       | 0.10.1                             |
| `chore: ...` | A change that needs no release  | no release                         |

`perf`, `refactor`, `docs`, `build`, `types`, `examples`, `test`, `style`, `ci` and `revert` do not release either. Use `fix` for an internal improvement that consumers should get. Several pull requests in one release combine into the highest bump, and every releasing title becomes a changelog entry.

When a releasing change lands on `main`, the `Release NPM version PR` workflow opens or updates one pull request titled `Release: Frontend packages` from the `nx-release-branch--main` branch. It writes the new versions and changelog entries. Merging that pull request releases the packages. To preview it, run the workflow from the Actions tab with `dry_run` enabled.

After the release pull request is merged, the `Release NPM independent packages` workflow builds and packs every package tagged `release:independent`, skips versions that are already on npm, validates the rest and publishes them to the `latest` dist-tag from the `npm-publish` environment. It only publishes stable versions and fails on a prerelease. If a publish fails, fix the cause and run the workflow again from the Actions tab; it publishes only what is still missing. Run it with `dry_run` enabled to build, pack and validate without publishing.

Publishing uses npm trusted publishing, so there is no npm token. Each independent package needs a one-time trusted publisher entry on npmjs.com (package settings, "Trusted Publisher", GitHub Actions) with the organization `grafana`, the repository `grafana`, the workflow filename `release-npm-independent-packages.yml` and the environment `npm-publish`. To make another package independent, add it to a release group in `nx.json` with `version.conventionalCommits` enabled, add the `release:independent` tag to its `project.json`, add its path and scope to the `Check plugin-compat pull request title` workflow, create its first release tag, and register its trusted publisher.

Nx finds the changes since the last release from the `<name>@<version>` git tag of the package, for example `@grafana/plugin-compat@0.10.0`. After publishing, the workflow tags the merged release commit with each published `<name>@<version>`, and `nx release version` fails if a package has no tag at all. Do not delete these tags. If the publish run fails, re-run it from the Actions tab rather than starting a new manual run, because only the run triggered by the merge creates tags.

### Stable releases

> **Even though packages are released under a stable version, they are considered ALPHA until further notice!**

Stable releases are published under the `latest` tag on npm. If there was alpha/beta version released previously, the `next` tag is updated to stable version.

### Alpha and beta releases

Alpha and beta releases are published under the `next` tag on npm.

### Automatic prereleases

The `release-npm.yml` workflow publishes packages and is given the version to publish. Nightly runs publish only `@grafana/e2e-selectors`, and only if it changed since the last nightly publish.

### Manual release

> All of the steps below must be performed on a release branch, according to Grafana Release Guide.

> You must be logged in to NPM as part of Grafana NPM org before attempting to publish to the npm registry.

1. Run `pnpm packages:clean` script from the root directory. This will delete any previous builds of the packages.
2. Run `pnpm packages:prepare <version>` script from the root directory, for example `pnpm packages:prepare 6.3.0-alpha.1`. This writes the version to every package in the `grafana` release group. The version should be the same as the one being released.
   - Make sure you use semver convention. So, _place a dot between prerelease id and prerelease number_, i.e. 6.3.0-alpha.1
3. Run `pnpm packages:build` script that compiles distribution code in `packages/grafana-*/dist`.
4. Run `pnpm packages:pack` script to compress each package into `npm-artifacts/*.tgz` files. This is required for pnpm to replace properties in the package.json files declared in the `publishConfig` property.
5. Depending on whether or not it's a prerelease:
   - When releasing a prerelease run `./scripts/publish-npm-packages.sh --dist-tag 'next' --registry 'https://registry.npmjs.org/'` to publish new versions.
   - When releasing a stable version run `./scripts/publish-npm-packages.sh --dist-tag 'latest' --registry 'https://registry.npmjs.org/'` to publish new versions.
   - When releasing a test version run `./scripts/publish-npm-packages.sh --dist-tag 'test' --registry 'https://registry.npmjs.org/'` to publish test versions.

6. Revert any changes made by the `packages:prepare` script.

### Building individual packages

To build individual packages, run:

```
pnpm nx run @grafana/<data|e2e-selectors|runtime|schema|ui>:build
```

### Setting up @grafana/\* packages for local development

A known issue with @grafana/\* packages is that a lot of times we discover problems on canary channel(see [versioning overview](#Versioning)) when the version was already pushed to npm.

We can easily avoid that by setting up a local packages registry and test the packages before actually publishing to npm.

In this guide you will set up [Verdaccio](https://verdaccio.org/) registry locally to fake npm registry. This will enable testing @grafana/\* packages without the need for pushing to main.

#### Setting up local npm registry

From your terminal:

1. Navigate to `devenv/local-npm` directory.
2. Run `docker compose up`. This will start your local npm registry, available at http://localhost:4873/.
3. To test `@grafana` packages published to your local npm registry, add `@grafana:registry=http://localhost:4873/` to the `.npmrc` file of the project that installs them.

#### Publishing packages to local npm registry

You need to follow [manual packages release procedure](#manual-release). The only difference is the last command in order to publish to you local registry.

From your terminal:

1. Run `pnpm packages:clean`.
2. Run `pnpm packages:prepare`.
3. Run `pnpm packages:build`.
4. Run `pnpm packages:pack`.
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
