# Grafana Saga Icons

This package contains the icon React components used in Grafana and Grafana plugins.

## Uploading a new icon

To add a new icon to the library, open a PR which adds the SVG file for the icon into the `svg` directory. The file should be named with the icon name in kebab-case. For example, if the icon name is `MyIcon`, the file should be named `my-icon.svg`. Once the PR is merged, the icon will be automatically generated and added to the library.

## Development

1. Clone the repository
2. Run `yarn install`
3. After the installation, the icon components can be found in the `src/icons-gen` directory.
4. To regenerate/update the components, run `yarn generate`.
