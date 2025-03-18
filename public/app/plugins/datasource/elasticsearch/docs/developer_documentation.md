# ElasticSearch data source in Grafana

ElasticSearch is the built-in core data source and one of the oldest and most popular data sources in Grafana. When refactoring and improving, it's important to consider that many users have legacy dashboards, annotations and configs that need to remain compatible.

## Running queries using backend

Queries in the ElasticSearch data source are now exclusively run through the backend. This change is detailed in [this document](https://docs.google.com/document/d/1oLfVh54gReZEN9FdlJ0Wuo7Ja8XhSbjJ15FkRisPGs8/edit#heading=h.nuqzkh8bfixf). The `enableElasticSearchBackendQuerying` feature toggle, which allowed switching between frontend and backend modes, was removed in Grafana 11.1.0. In case of reported issues, please refer to the linked document.

## Development

When developing for ElasticSearch, use `make devenv sources=elastic`. To specify a version, use `make devenv sources=elastic elastic_version=7.17.0`. In `devenv/docker/blocks/elastic/data/data.js`, you can update data to suit your debugging and testing needs. Additionally, ElasticSearch has a couple of debugging dashboards located in `devenv/dev-dashboards/datasource-ElasticSearch`.

## Instrumentation

The ElasticSearch data source has improved instrumentation with logs, metrics, traces, and dashboards. When debugging issues, it is useful to review the available telemetry signals.

## Technical debt

Here is a list of our current technical debt.

### Database field

Previously, users stored ElasticSearch indices in the `database` field, which has since been deprecated. It is now stored in `jsonData` (implemented in https://github.com/grafana/grafana/pull/62808), though we continue to support both fields. Eventually, support for the `database` field will need to be removed.

## Supported Explore and Log features

Many Explore and Log features are implemented through `DataSourceWithXXXSupport`, making it clear which functionalities are supported.

## Supported ES Versions and version changes

The supported ElasticSearch version is documented at https://grafana.com/docs/grafana/latest/datasources/ElasticSearch/#supported-ElasticSearch-versions. We typically update it with major Grafana versions, following ElasticSearch [Elastic Product End of Life Dates](https://www.elastic.co/support/eol) to the last supported versions of ElasticSearch available at the time of Grafana's release.
