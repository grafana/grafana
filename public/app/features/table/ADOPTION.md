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

| Event                             | Trigger                                      | Properties                                                                                                                                                     |
| --------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grafana_table_viewed_features`   | Eligible Table renders usable data           | Boolean availability properties for column management, filtering, pagination, zebra striping, and row numbers; `zebra_striping_enabled`, `row_numbers_enabled` |
| `grafana_table_changed_columns`   | User successfully changes column state       | `action`: hide, show, reorder                                                                                                                                  |
| `grafana_table_changed_filter`    | User applies or removes a filter             | `action`: apply, remove; `filter_type`: local, transformation, adhoc; `filter_kind`: values, numeric_range, date_range, other                                  |
| `grafana_table_cleared_changes`   | User clears existing Table changes           | No user-derived content                                                                                                                                        |
| `grafana_table_started_promotion` | User starts promoting existing Table changes | No user-derived content                                                                                                                                        |

`filter_type` describes the filter execution path; `filter_kind` describes the control used. Record `numeric_range` and `date_range` on both application and removal, using the removed filter's kind for removal. Never include range bounds or selected values.

For zebra striping and row numbers, record availability separately from effective enabled state on the view event. Enabled state means the feature is actually rendered, accounting for feature gates and local overrides, not merely saved as a panel option. Row numbers include the temporary Columns sidebar override introduced by grafana/grafana#136862; a local visibility change should update the view measurement without being counted as a new exposure. Finalize state-change deduplication with the view event implementation.

Pagination remains an availability dimension only; no pagination interaction event is planned.

Do not emit interaction events on hydration, data refresh, no-op changes, or rejected operations. Define exposure deduplication before implementing the view event; raw view counts are not unique users. Do not include field names, values, filter expressions, dashboard titles, or duplicate automatically attached identity fields.

## Dashboard contract

1. Separate availability from actual usage. Show exposed users/stacks and interacting users/stacks independently.
2. Show daily and weekly distinct users/stacks by feature, plus total interaction event counts labelled as interactions. Break out numeric-range and date-range filter usage. Show zebra striping and row numbers as rendered enabled-state usage, separately from interaction counts; do not infer an explicit user action from an enabled state.
3. Calculate adoption with matching feature-specific eligible populations and time windows. Never divide by all Cloud users or interpret enablement as interaction.
4. Include an internal-usage selector using verified identity fields. Report unknown identity separately; missing email does not prove external usage.
5. Restrict to Cloud using validated source/stack attribution. Do not infer Cloud solely from an event name.
6. Use staged RudderStack models, bounded time filters, and validated identity joins. New event tables require dbt staging models in `grafana/dbt_grafanalabs_global`.

## Remaining validation

The Text panel v2 reference dashboard UID is `adbm6b2`. The connected Grafana API returned HTTP 401 during the initial review; its queries and event model have not been inspected. Dashboard JSON and production SQL must wait for verified datasource, schemas, and identity semantics.

Complete shared-component event audit; implement and test actual interaction callbacks; inspect the reference dashboard; validate representative Cloud records; create staging models and dashboard; link the deployed dashboard from issues #1038 and #1003.

Analytics opt-out, blocked SDKs, missing identities, and rollout/version differences can reduce coverage. Starting promotion measures intent, not persistence. Existing production records cannot validate events that have not shipped.
