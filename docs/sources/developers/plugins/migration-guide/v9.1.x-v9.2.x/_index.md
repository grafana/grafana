---
aliases:
  - ../../plugins/developing/migration-guide#from-version-91x-to-92x
description: Guide for migrating plugins from Grafana v9.1.x to v9.2.x
keywords:
  - grafana
  - plugins
  - migration
  - plugin
  - documentation
title: Migrating plugins from Grafana 9.1.x to 9.2.x
menutitle: v9.1.x to v9.2.x
weight: 2100
---

# Migrating plugins from Grafana version 9.1.x to 9.2.x

## React and React-dom as peer dependencies

In earlier versions of Grafana packages `react` and `react-dom` were installed during a `yarn install` regardless of a plugins dependencies. In 9.2.0 the `@grafana` packages declare these react packages as peerDependencies and will need adding to a plugins `package.json` file for test commands to continue to run successfully.

Example:

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

## NavModelItem requires a valid icon name

The typings of the `NavModelItem` have improved to only allow a valid `IconName` for the icon property. You can find the complete list of valid icons [here](https://github.com/grafana/grafana/blob/v9.2.0-beta1/packages/grafana-data/src/types/icon.ts). The icons specified in the list will work for older versions of Grafana 9.

Example:

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

FieldProps, ModalProps, and QueryFieldProps are now exposed from `@grafana/ui`. They can be imported in the same way as other types.

Example:

```ts
import { FieldProps, ModalProps, QueryFieldProps } from '@grafana/ui';
```
