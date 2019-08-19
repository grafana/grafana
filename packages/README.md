## Grafana frontend packages

## Releasing new version
We use [Lerna](https://github.com/lerna/lerna) for packages versioning and releases

### Manual release
1. Run `packages:prepare` script from root directory. This will perform cleanup, run all tests and bump version for all packages. Also, it will create `@packages@[version]` tag and version bump commit with `Packages: publish [version]` message.
2. Run `packages:build` script that will prepare distribution packages.
3. Run `packages:publish` to publish new versions
   - add `--dist-tag next` to publish under `next` tag
4. Push version commit

### Building individual packages
To build induvidual packages run `grafana-toolkit package:build --scope=<ui|toolkit|runtime|data>`

