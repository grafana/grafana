# Examples

Same topic at each level: **Grafana repo architecture**. Copy the shape, not the boxes, when the description is a different system.

## mermaid L100 Grafana repo architecture

**L100 — Grafana as a monitoring UI in front of data sources**

```mermaid
flowchart TB
  user["User"]
  grafana["Grafana"]
  store["Grafana database"]
  datasources["External data sources"]

  user --> grafana
  grafana --> store
  grafana --> datasources
```

Users open Grafana to view and alert on telemetry. Grafana persists its own state (dashboards, users, settings) and queries external systems for data. No frontend/backend split, plugins, or storage variants.

## mermaid L200 Grafana repo architecture

**L200 — Grafana monorepo: UI, API, apps, plugins, storage**

```mermaid
flowchart TB
  subgraph clients["Clients"]
    browser["Browser"]
  end

  subgraph frontend["Frontend"]
    react["React app"]
    pkgs["Shared TS packages"]
    fePlugins["Built-in UI plugins"]
  end

  subgraph backend["Backend"]
    api["HTTP API"]
    services["Domain services"]
    apps["App SDK apps"]
    plugins["Plugin system"]
    tsdb["Query backends"]
  end

  subgraph storage["Storage"]
    sql["SQL store"]
    unified["Unified storage"]
  end

  dbs["SQLite / Postgres / MySQL"]
  datasources["Prometheus, Loki, CloudWatch, ..."]

  browser --> react
  react --> pkgs
  react --> fePlugins
  react --> api
  api --> services
  api --> apps
  services --> plugins
  services --> tsdb
  services --> sql
  services --> unified
  plugins --> fePlugins
  tsdb --> datasources
  sql --> dbs
  unified --> dbs
```

Container-level view of `public/app`, `packages/`, `pkg/`, `apps/`, and `pkg/storage`. Request path is UI → HTTP API → services or App SDK apps → SQL / unified storage / plugin query backends. File-level handlers and individual services are omitted.

## mermaid L300 Grafana query path

**L300 — Component view of a dashboard query**

```mermaid
flowchart TB
  subgraph frontend["public/app"]
    dash["dashboard / dashboard-scene"]
    queryUI["query feature"]
    dsPlugin["datasource plugin UI"]
  end

  subgraph apiLayer["pkg/api + pkg/services"]
    queryAPI["query HTTP API"]
    querySvc["query service"]
    dsSvc["datasources service"]
  end

  subgraph exec["Execution"]
    tsdb["pkg/tsdb backend"]
    pluginMgr["pkg/plugins manager"]
    extPlugin["external plugin"]
  end

  dash --> queryUI
  queryUI --> dsPlugin
  dsPlugin --> queryAPI
  queryAPI --> querySvc
  querySvc --> dsSvc
  querySvc --> tsdb
  querySvc --> pluginMgr
  pluginMgr --> extPlugin
```

Packages and domain services on the dashboard query path. Inspect `public/app/features/dashboard`, `public/app/features/query`, `pkg/services/query`, `pkg/tsdb`, `pkg/plugins`. Authn, alerting, and unified storage are out of scope.

## mermaid L400 Grafana query HTTP handler

**L400 — Sequence of one query request through the API**

```mermaid
sequenceDiagram
  participant UI as Query editor
  participant API as pkg/api query handler
  participant QS as query service
  participant DS as datasources service
  participant BE as tsdb or plugin backend

  UI->>API: POST query
  API->>QS: run queries
  QS->>DS: resolve datasource
  DS-->>QS: plugin + settings
  QS->>BE: execute
  BE-->>QS: frames
  QS-->>API: response
  API-->>UI: series
```

Single request. Node names must match real packages/handlers you opened; replace this sketch after reading the handler and service entrypoints. Do not expand into dashboard persistence or alerting on the same canvas.
