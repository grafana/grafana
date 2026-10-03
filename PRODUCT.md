# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are SREs, DevOps engineers, and platform engineers who monitor systems they operate. They build and maintain dashboards, run ad-hoc investigations (Explore), configure alerting rules and notification routing, and manage data source connections — usually under time pressure while diagnosing an incident or verifying a rollout.

Secondary audiences exist at the edges: business/exec viewers of shared dashboards, and public-dashboard visitors with no Grafana account viewing read-only, shared views (e.g. status pages). These audiences consume rather than build, and expect a lighter, unauthenticated experience.

## Product Purpose

Grafana lets users query, visualize, alert on, and understand metrics, logs, and traces regardless of where that data is stored. It exists to unify observability across heterogeneous backends into one dashboarding, exploration, and alerting surface, so teams can build a shared, data-driven understanding of the systems they run. Success means a user can go from "something might be wrong" to a confirmed diagnosis, or from raw telemetry to a shared dashboard, without leaving the product.

## Positioning

Grafana's mechanism is data-source agnosticism: one dashboarding and alerting layer that queries and mixes many backends (Prometheus, Loki, Tempo, cloud vendor APIs, SQL, and more) — including per-query mixing of different sources in the same panel — rather than being a frontend bound to one vendor's storage. This is what a single-backend observability vendor's UI could not truthfully copy.

## Operating Context

- Dashboards are built and viewed continuously, often during live incident response where clarity and speed matter more than novelty.
- Explore is used for ad-hoc, exploratory querying across metrics, logs, and traces, including splitting views to compare time ranges or queries side by side.
- Alerting rules are authored, evaluated continuously, and routed to external notification systems (Slack, PagerDuty, OpsGenie, etc.).
- Public dashboards allow sharing a read-only, unauthenticated view of a dashboard outside the organization (e.g. a public status page) — a distinct, lower-trust surface from the authenticated app.
- Deployed and used across OSS, Enterprise, and Cloud editions, and across on-prem, self-managed, and hosted deployments.

## Capabilities and Constraints

- Panel plugin architecture: visualizations are pluggable (timeseries, table, canvas, geomap, etc.), and third-party/community panel and data source plugins extend the product.
- Data source plugin architecture: backends are pluggable and mixable within a single dashboard or panel.
- Template variables make dashboards dynamic and reusable across environments/services via dropdown-driven substitution.
- Public dashboards are unauthenticated by design — they must not leak information, controls, or affordances meant only for authenticated/admin users.
- Must remain usable at large scale (many panels, high-cardinality data, long time ranges) without the UI becoming the bottleneck.

## Brand Commitments

Grafana Labs branding and existing visual identity (logo, color system, dark/light theming) are established and binding; the incumbent implementation and design tokens are the source of truth rather than a fact restated here.

## Evidence on Hand

No additional testimonials, case studies, or benchmark data are recorded here beyond what already exists in the product's own marketing site and docs (grafana.com). Do not fabricate customer quotes, pricing, or adoption numbers in product surfaces built from this record.

## Product Principles

1. Meet the user mid-incident: prioritize speed, clarity, and low cognitive load over novelty, especially in dashboards, Explore, and alerting.
2. Never assume a single data source: every workflow should degrade gracefully to "pluggable and mixable," not "built for one backend."
3. Authenticated and public/unauthenticated surfaces are different trust boundaries — public dashboards must never imply the affordances or data access of the full app.
4. Support OSS, Enterprise, and Cloud without the UI silently assuming one tier's feature set is universal.

## Accessibility & Inclusion

Committed standard: WCAG 2.1 AA.
