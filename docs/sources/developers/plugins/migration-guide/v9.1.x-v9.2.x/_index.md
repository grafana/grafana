---
title: Migrate plugins from Grafana version 9.1.x to 9.2.x
menuTitle: v9.1.x to v9.2.x
description: Guide for migrating plugins from Grafana v9.1.x to v9.2.x
keywords:
  - grafana
  - plugins
  - migration
  - plugin
  - documentation
weight: 2100
---

# Migrate plugins from Grafana version 9.1.x to 9.2.x

Follow the instructions in this section to migrate plugins from Grafana version 9.1.x to 9.2.x.

## React and React-dom as peer dependencies

In earlier versions of Grafana packages, `react` and `react-dom` were installed during a `yarn install` command regardless of a plugin's dependencies. In version 9.2.0, the `@grafana` packages declare these React packages as `peerDependencies` and must be added to a plugin's `package.json` file for test commands.

**Example:**

```json
// before
"dependencies": {
  "@grafana/data": "9.1.0",
  "@grafana/ui": "9.1.0",
},

// after
"dependencies": {
  "@grafana/data": "9.2.0",
  "@grafana/ui": "9.2.0",
  "react": "17.0.2",
  "react-dom": "17.0.2"
},

```

## `NavModelItem` requires a valid icon name

The typings of the `NavModelItem` have improved to only allow a valid `IconName` for the icon property. For a complete list of valid icons, refer to the [source code](https://github.com/grafana/grafana/blob/v9.2.0-beta1/packages/grafana-data/src/types/icon.ts). These icons will work for older versions of Grafana 9.

**Example:**

```ts
// before
const model: NavModelItem = {
  id: 'settings',
  text: 'Settings',
  icon: 'fa fa-cog',
  url: `${baseUrl}/settings`,
};

// after
const model: NavModelItem = {
  id: 'settings',
  text: 'Settings',
  icon: 'cog',
  url: `${baseUrl}/settings`,
};
```

## Additional type availability

`FieldProps`, `ModalProps`, and `QueryFieldProps` are now exposed from `@grafana/ui`. They can be imported in the same way as other types.

**Example:**

```ts
import { FieldProps, ModalProps, QueryFieldProps } from '@grafana/ui';
```
