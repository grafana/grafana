# Grafana UI components library

> **@grafana/ui is currently in BETA**.

@grafana/ui is a collection of components used by [Grafana](https://github.com/grafana/grafana)

Our goal is to deliver Grafana's common UI elements for plugins developers and contributors.

See [package source](https://github.com/grafana/grafana/tree/master/packages/grafana-ui) for more details.

## Installation

`yarn add @grafana/ui`

`npm install @grafana/ui`

## Development

For development purposes we suggest using `yarn link` that will create symlink to @grafana/ui lib. To do so navigate to `packages/grafana-ui` and run `yarn link`. Then, navigate to your project and run `yarn link @grafana/ui` to use the linked version of the lib. To unlink follow the same procedure, but use `yarn unlink` instead.
