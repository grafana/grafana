# App capture attribution

The shared Add to notebook picker snapshots the source app when it opens. The same source follows a successful create, each cell appended to an existing notebook, and failed submissions. It is not inferred again after a network request or navigation.

Existing `source: plugin` remains unchanged. The optional `source_app` property is a bounded label: `agent_o11y`, `app_o11y`, `logs_drilldown`, `metrics_drilldown`, `traces_drilldown`, `profiles_drilldown`, `k6`, `irm`, `slo`, `synthetic_monitoring`, `kubernetes`, `database_o11y`, `cloud_provider_o11y`, `frontend_o11y`, or `other_plugin`. Routes, service names, test names, queries and notebook content are not added to analytics. Non-plugin events omit the property.

## Events

- `grafana_notebook_add_to_notebook_opened`: one event per picker mount, not on every render.
- `grafana_notebook_created`: successful notebook creation, retaining the existing target and time-lock properties.
- `grafana_notebook_cell_added_from_add_to_notebook`: one successful cell added to an existing notebook. This is a cell count, not a count of save operations.
- `grafana_notebook_add_to_notebook_failed`: an unsuccessful submit, retaining the existing target, reason and time-lock properties.

Compare source-app adoption and successful captures. Do not count opening the picker as adoption or call every open without a successful save a failure: users can cancel, retry, or add several cells. Creation and existing-notebook events are different grains.

For a notebook already open in a scene, the existing added-cell event means the scene accepted the change and triggered autosave, not that the backend acknowledged that autosave. Keep existing autosave failure events in the reliability readout. These client events are product analytics, not a durable audit log.

The host implements attribution for both exposed form versions, so existing consumers such as Logs Drilldown need no event-specific wiring. An embedded consumer not running under its own app route is `other_plugin`, rather than guessed from content. Adding a mapping enables attribution but does not implement capture UI in a new app.

Local tests verify payloads and write timing, not RudderStack delivery. Before production reporting, verify events in the dev RudderStack live view, extend the existing notebook dbt staging models for `source_app`, and add a staging model for the new opened event. No reporting dashboard or dbt changes are included in this POC.
