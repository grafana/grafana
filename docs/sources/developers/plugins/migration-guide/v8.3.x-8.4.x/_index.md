---
aliases:
  - ../../plugins/developing/migration-guide#from-version-83x-to-84x
description: Guide for migrating plugins from Grafana v8.3.x to v8.4.x
keywords:
  - grafana
  - plugins
  - migration
  - plugin
  - documentation
title: Migrating plugins from Grafana version 8.3.x to 8.4.x
menutitle: v8.3.x to v8.4.x
---

# Migrating plugins from Grafana version 8.3.x to 8.4.x

This section explains how to migrate Grafana v8.3.x plugins to the updated plugin system available in Grafana v8.4.x. Depending on your plugin, you need to perform one or more of the following steps.

## Value Mapping Editor has been removed from @grafana-ui library

Removed due to being an internal component.

## Thresholds Editor has been removed from @grafana-ui library

Removed due to being an internal component.

## 8.4 deprecations

### LocationService replaces getLocationSrv

In a previous release, we migrated to use a new routing system and introduced a new service for managing locations, navigation, and related information. In this release, we are making that new service the primary service.

**Example:** Import the service.

```ts
// before
import { getLocationSrv } from '@grafana/runtime';

// after
import { locationService } from '@grafana/runtime';
```

**Example:** Navigate to a path and add a new record in the navigation history so that you can navigate back to the previous one.

```ts
// before
getLocationSrv.update({
  path: '/route-to-navigate-to',
  replace: false,
});

// after
locationService.push('/route-to-navigate-to');
```

**Example:** Navigate to a path and replace the current record in the navigation history.

```ts
// before
getLocationSrv.update({
  path: '/route-to-navigate-to',
  replace: true,
});

// after
locationService.replace('/route-to-navigate-to');
```

**Example:** Update the search or query parameter for the current route and add a new record in the navigation history so that you can navigate back to the previous one.

```ts
// How to navigate to a new path
// before
getLocationSrv.update({
  query: {
    value: 1,
  },
  partial: true,
  replace: false,
});

// after
locationService.partial({ value: 1 });
```

**Example:** Update the search or query parameter for the current route and add replacing it in the navigation history.

```ts
// before
getLocationSrv.update({
  query: {
    'var-variable': 1,
  },
  partial: true,
  replace: true,
});

// after
locationService.partial({ 'var-variable': 1 }, true);
```