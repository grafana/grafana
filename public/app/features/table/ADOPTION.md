# Table Cloud adoption measurement

Implementation draft for grafana/grafana-org#1038. No events described below have been shipped yet.

## Initial audit

At main commit `7ba691e5fb2`, neither `public/app/features/table` nor the Table panel contains direct `reportInteraction` calls. Shared Table UI and dashboard actions still require a complete audit before adding instrumentation.

- `TablePanel.tsx` resolves feature availability separately from data and column capabilities. Availability must not count as usage.
- `useAdHocColumnState` delegates column changes to the shared `useColumnTransformations` hook. Instrument successful user actions, not hook execution or restored state.
- `PanelAdHocChangesAction.tsx` owns clear/promote actions. These actions are shared across panel types: attribute Table usage explicitly.
- `promotePanelAdHocChanges.ts` opens a save flow that can be cancelled. Starting promotion is not a successful dashboard save.

## Proposed measurement contract

Use distinct events for actions, with bounded properties. Names below are proposed, pending the reference-dashboard review.

| Event                              | Trigger                                      | Properties                                                                   |
| ---------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| `grafana_table_viewed_features`    | Eligible Table renders usable data           | Boolean availability properties for column management, filtering, pagination |
| `grafana_table_changed_columns`    | User successfully changes column state       | `action`: hide, show, reorder                                                |
| `grafana_table_changed_filter`     | User applies or removes a filter             | `action`: apply, remove; `filter_type`: local, transformation, adhoc         |
| `grafana_table_changed_pagination` | User changes page or page size               | `action`: page, page_size                                                    |
| `grafana_table_cleared_changes`    | User clears existing Table changes           | No user-derived content                                                      |
| `grafana_table_started_promotion`  | User starts promoting existing Table changes | No user-derived content                                                      |

Do not emit on hydration, data refresh, no-op changes, or rejected operations. Define exposure deduplication before implementing the view event; raw view counts are not unique users. Do not include field names, values, filter expressions, dashboard titles, or duplicate automatically attached identity fields.

## Dashboard contract

1. Separate availability from actual usage. Show exposed users/stacks and interacting users/stacks independently.
2. Show daily and weekly distinct users/stacks by feature, plus total event counts labelled as interactions.
3. Calculate adoption with matching feature-specific eligible populations and time windows. Never divide by all Cloud users or interpret enablement as interaction.
4. Include an internal-usage selector using verified identity fields. Report unknown identity separately; missing email does not prove external usage.
5. Restrict to Cloud using validated source/stack attribution. Do not infer Cloud solely from an event name.
6. Use staged RudderStack models, bounded time filters, and validated identity joins. New event tables require dbt staging models in `grafana/dbt_grafanalabs_global`.

## Remaining validation

The Text panel v2 reference dashboard UID is `adbm6b2`. The connected Grafana API returned HTTP 401 during the initial review; its queries and event model have not been inspected. Dashboard JSON and production SQL must wait for verified datasource, schemas, and identity semantics.

Complete shared-component event audit; implement and test actual interaction callbacks; inspect the reference dashboard; validate representative Cloud records; create staging models and dashboard; link the deployed dashboard from issues #1038 and #1003.

Analytics opt-out, blocked SDKs, missing identities, and rollout/version differences can reduce coverage. Starting promotion measures intent, not persistence. Existing production records cannot validate events that have not shipped.
