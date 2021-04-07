# Dashboard Schemas

Schema description documents for [Grafana Dashboard
JSON](https://grafana.com/docs/grafana/latest/reference/dashboard/) and core
panels.

> **Note:** This directory is experimental. The schemas are not currently
> implemented or enforced in Grafana.

Schemas are defined in [Cue](https://cuelang.org/). Cue was chosen because it
strongly facilitates our primary use cases - [schema
definition](https://cuelang.org/docs/usecases/datadef/), [data
validation](https://cuelang.org/docs/usecases/validation/), and [code
generation/extraction](https://cuelang.org/docs/usecases/generate/).

## Schema Organization

Each schema describes part of a dashboard. `Dashboard.cue` is the main dashboard
schema object. All other schemas describe nested objects within a dashboard.
They are grouped in the following directories:

* `panels` - schemas for
  [panels](https://grafana.com/docs/grafana/latest/panels/panels-overview/).
* `targets` - targets represent
  [queries](https://grafana.com/docs/grafana/latest/panels/queries/). Each [data
  source](https://grafana.com/docs/grafana/latest/datasources/) type has a
  unique target schema.
* `variables` - schemas for
  [variables](https://grafana.com/docs/grafana/latest/variables/variable-types/).
* `transformations` - schemas for
  [transformations](https://grafana.com/docs/grafana/latest/panels/transformations/types-options/).

The following somewhat conveys how they fit together when constructing a
dashboard:

```
+-----------+      +-----------+
| Dashboard +------> Variables |
+---------+-+      +-----------+
          |    +--------+    +---------+
          +----> Panels +----> Targets |
               +------+-+    +---------+
                      |      +-----------------+
                      +------> Transformations |
                             +-----------------+
```

## Definitions

All schemas are [Cue
definitions](https://cuelang.org/docs/references/spec/#definitions-and-hidden-fields).
Schemas intended to be exported must begin with a capital letter. For example,
[Gauge](./panels/Gauge.cue). Definitions beginning with a lowercase letter will
not be exported. These are reusable components for constructing the exported
definitions. For example, [`#panel`](./panels/panel.cue) is intended to
be a base schema for panels. `#Gauge` extends `#panel` with the following:

```
#Gauge: panel & {
	...
}
```

## Exporting OpenAPI

[OpenAPI](https://www.openapis.org/) schemas can be exported from these CUE
sources.

### Command Line

While you can use `cue export` to output OpenAPI documents, it does not expand
references which makes the output unusable.

```
cue export --out openapi -o - ./...
```

### Using Go

You need to use Go to generate useable OpenAPI schemas. This directory contains
a Go program that will output just the OpenAPI schemas for one or many Cue
packages.

```
go run . <entrypoint> ...
```
