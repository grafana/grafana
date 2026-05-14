---
description: Learn what legacy dashboard API deprecation telemetry is collected and how to migrate your plugin.
keywords:
  - grafana
  - plugins
  - migration
  - dashboard
  - scenes
  - deprecation
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Migrate from legacy dashboard APIs
menuTitle: Legacy dashboard API deprecation
weight: 100
---

# Migrate from legacy dashboard APIs

This guide explains what legacy dashboard API usage Grafana detects in plugins, why those APIs are deprecated, and what you should do to update your plugin.

## What's being detected

Grafana instruments plugin call sites in the legacy (non-scenes) dashboard architecture. Each surface has an `apiName` value that appears in deprecation warnings and telemetry.

| `apiName`                         | What triggers it                                                                                                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PanelMigrationHandler.invoke`    | The legacy `PanelModel.pluginLoaded()` code path actually invoked a panel plugin's `onPanelMigration` handler. This only fires in non-scenes flows (alerting rule editor, library panels, panel editor Redux). |
| `DashboardSrv.getCurrent`         | A plugin called `getDashboardSrv().getCurrent()`. The returned object is a scenes compatibility wrapper, but the API itself is the legacy `DashboardSrv` singleton, not a scenes-native API.                   |
| `RefreshEvent.subscribe`          | A plugin subscribed to the legacy `RefreshEvent`.                                                                                                                                                              |
| `RefreshEvent.getStream`          | A plugin got a stream of the legacy `RefreshEvent`.                                                                                                                                                            |
| `TimeRangeUpdatedEvent.subscribe` | A plugin subscribed to the legacy `TimeRangeUpdatedEvent`.                                                                                                                                                     |
| `TimeRangeUpdatedEvent.getStream` | A plugin got a stream of the legacy `TimeRangeUpdatedEvent`.                                                                                                                                                   |
| `CopyPanelEvent.subscribe`        | A plugin subscribed to the legacy `CopyPanelEvent`.                                                                                                                                                            |
| `CopyPanelEvent.getStream`        | A plugin got a stream of the legacy `CopyPanelEvent`.                                                                                                                                                          |

## Why these APIs are deprecated

The legacy non-scenes dashboard architecture is being removed from Grafana. Once removed, any plugin that relies on these call sites will stop working. Telemetry helps the Grafana team understand the blast radius before setting removal dates.

## How to know if your plugin is affected

When Grafana detects your plugin using a deprecated API, it logs a browser console warning:

```text
[grafana] Plugin "<your-plugin-id>" used deprecated dashboard API "<apiName>"
```

Open your browser DevTools, load any dashboard that uses your plugin, and check the **Console** tab for these messages.

## Migration paths

### `PanelMigrationHandler.invoke`

Scenes doesn't invoke the handler registered with `PanelPlugin.setMigrationHandler()` during normal dashboard load. If your plugin registered a migration handler to upgrade stored panel options, that logic no longer runs in scenes-powered dashboards.

Migrate your option-upgrade logic to `PanelPlugin.setPanelChangeHandler()` (`onPanelTypeChanged`). Scenes still calls `onPanelTypeChanged` during Angular-era panel deserialisation, so this is the correct place for panel-type and option migration.

### `DashboardSrv.getCurrent`

The `getDashboardSrv().getCurrent()` call returns a compatibility wrapper in scenes-powered dashboards, but the `DashboardSrv` singleton is a legacy concept. For scenes-native dashboard inspection, refer to the `@grafana/scenes` package documentation for the appropriate scene context APIs.

### App-event subscriptions (`RefreshEvent`, `TimeRangeUpdatedEvent`, `CopyPanelEvent`)

Subscribing to these legacy app events isn't scenes-native. Scenes manages state and re-render lifecycle through its own scene objects and observables. For time-range updates, use the time-range observables in `@grafana/scenes`. For refresh behaviour, rely on scenes' built-in re-render mechanics. Refer to the `@grafana/scenes` documentation for the equivalent patterns.

## Timeline

The removal date for the deprecated APIs is TBD. The deprecation cadence will be set once telemetry data has been collected over at least one release cycle.
