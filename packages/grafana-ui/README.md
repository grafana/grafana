# Grafana UI components library

@grafana/ui is a collection of components used by [Grafana](https://github.com/grafana/grafana)

Our goal is to deliver Grafana's common UI elements for plugins developers and contributors.

Browse the [Storybook catalog of the components](http://developers.grafana.com/).

See [package source](https://github.com/grafana/grafana/tree/main/packages/grafana-ui) for more details.

## Installation

`pnpm add @grafana/ui`

`npm install @grafana/ui`

## Development

For local development, link the library from the consuming project with `pnpm link /absolute/path/to/grafana/packages/grafana-ui`. Run `pnpm unlink @grafana/ui` in that project to remove the link.
