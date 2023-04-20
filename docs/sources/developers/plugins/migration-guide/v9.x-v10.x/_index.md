---
description: Guide for migrating plugins from Grafana v9.x to v10.x
keywords:
  - grafana
  - plugins
  - migration
  - plugin
  - documentation
title: Migrating plugins from Grafana 9.x to 10.x
menutitle: v9.x to v10.x
weight: 1900
---

# Migrating plugins from Grafana version 9.x to 10.x

## Verifying plugin behaviour with React 18

Grafana 10 includes our upgrade to React 18 and use of the new React client rendering API. These changes were delivered to the core `grafana` repo with [PR 64428](https://github.com/grafana/grafana/pull/64428).

Whilst this brings us many significant benefits, there's a potential for this to impact the way your plugin works. In particular, there could be unintended side effects caused by the changes around improving consistency with `useEffect` timings and automatic batching of state updates.

Recommended actions:

- Review the React 18 [upgrade docs](https://react.dev/blog/2022/03/08/react-18-upgrade-guide)
- Test your plugins against one of the latest [grafana-dev docker images](https://hub.docker.com/r/grafana/grafana-dev/tags?page=1) (for example, [this one](https://hub.docker.com/layers/grafana/grafana-dev/10.0.0-111404pre/images/sha256-ac78acf54b44bd2ce7e68b796b1df47030da7f35e53b02bc3eec3f4de05f780f?context=explore))
- Add a comment to the [forum discussion](https://community.grafana.com/t/grafana-10-is-upgrading-to-react-18/86051) if your plugin is impacted in any way. Either to socialise the changes needed for your plugin or to reach out and ask for help yourself.
