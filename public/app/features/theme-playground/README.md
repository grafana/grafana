# Regenerating the schema

The schema for the theme options is generated using [ts-json-schema-generator](https://github.com/vega/ts-json-schema-generator/). To regenerate the schema (e.g. if the `NewThemeOptions` type has changed):

- remove the `@internal` comment
- run `npx ts-json-schema-generator --path 'packages/grafana-data/src/themes/createTheme.ts' --type 'NewThemeOptions'`
