# Grafana UI components library

@grafana/ui is a collection of components used by [Grafana](https://github.com/grafana/grafana)

Our goal is to deliver Grafana's common UI elements for plugins developers and contributors.

Browse the [Storybook catalog of the components](http://developers.grafana.com/).

See [package source](https://github.com/grafana/grafana/tree/main/packages/grafana-ui) for more details.

## Installation

`yarn add @grafana/ui`

`npm install @grafana/ui`

## Development

For development purposes we suggest using `yarn link` that will create symlink to @grafana/ui lib. To do so navigate to `packages/grafana-ui` and run `YARN_IGNORE_PATH=1 yarn link`. Then, navigate to your project and run `yarn link "@grafana/ui"` to use the linked version of the lib. To unlink follow the same procedure, but use `yarn unlink` instead.
