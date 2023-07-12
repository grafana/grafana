---
title: Migrate plugins from Grafana version 9.x to 10.x
menuTitle: v9.x to v10.x
description: Guide for migrating plugins from Grafana v9.x to v10.x
keywords:
  - grafana
  - plugins
  - migration
  - plugin
  - documentation
weight: 1900
---

# Migrate plugins from Grafana version 9.x to 10.x

## Verify plugin behavior with React 18

Grafana 10 includes our upgrade to React 18 and use of the new React client-side rendering API. These changes were delivered to the core `grafana` repo with [PR 64428](https://github.com/grafana/grafana/pull/64428).

Although these updates bring many significant benefits, there's a potential for them to impact the way that your plugin works. In particular, there could be unintended side effects caused by the changes around improving consistency with `useEffect` timings and automatic batching of state updates.

**Recommended actions:**

- Review the React 18 [upgrade docs](https://react.dev/blog/2022/03/08/react-18-upgrade-guide).
- Test your plugins against one of the latest [grafana-dev docker images](https://hub.docker.com/r/grafana/grafana-dev/tags?page=1) (for example, [this one](https://hub.docker.com/layers/grafana/grafana-dev/10.0.0-111404pre/images/sha256-ac78acf54b44bd2ce7e68b796b1df47030da7f35e53b02bc3eec3f4de05f780f?context=explore)).
- If your plugin is affected, add a comment to the [forum discussion](https://community.grafana.com/t/grafana-10-is-upgrading-to-react-18/86051). Be sure to communicate with us so we are aware of the issue and can provide help.

## Data frame field values are now just arrays

In Grafana 10, the values in data frames are now managed as simple JavaScript arrays (see [PR #66480](https://github.com/grafana/grafana/issues/66480)). It is no longer necessary to wrap values in a [Vector<T>](https://github.com/grafana/grafana/blob/v9.5.x/packages/grafana-data/src/types/vector.ts) implementation.

Most code targeting 9.x will continue to work without any issues. An exception is the rare case in which existing code directly implements [Vector<T>](https://github.com/grafana/grafana/blob/v9.5.x/packages/grafana-data/src/types/vector.ts) rather than extending or using base classes. In this case, the code should either return an array or extend [FunctionalVector<T>](https://github.com/grafana/grafana/blob/v10.0.x/packages/grafana-data/src/vector/FunctionalVector.ts#L9). All Vector implementations have been deprecated and will be removed in the future.

When writing plugins that should run on 9.x, continue to use the Vector interfaces. In this case, when targeting versions 10+, you can now use simple arrays rather than wrapper classes.

To make this transition seamless, we employed the Original JavaScript Sin™. That is, we [extended the native Array prototype](https://github.com/grafana/grafana/blob/v10.0.x/packages/grafana-data/src/types/vector.ts) with several Vector methods. We will atone and undo this in v11, when Vector interfaces and classes are removed.
