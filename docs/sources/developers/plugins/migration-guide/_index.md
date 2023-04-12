---
aliases:
  - ../../plugins/developing/migration-guide
keywords:
  - grafana
  - plugins
  - migration
  - plugin
  - documentation
title: Migration guides
---

<script>
(function () {
  var anchorRedirects = {
    "migrate-a-plugin-from-angular-to-react": "./angular-react/",
    "from-version-62x-to-74x": "./v6.x-v7.x/",
    "from-version-65x-to-73x": "./v6.x-v7.x/",
    "from-version-6x-to-7x": "./v6.x-v7.x/",
    "migrate-to-data-frames": "./v6.x-v7.x/",
    "troubleshoot-plugin-migration": "./v6.x-v7.x/",
    "from-version-7x-to-8x": "./v7.x-v8.x/",
    "from-version-83x-to-84x": "./v8.3.x-8.4.x/",
    "from-version-8x-to-9x": "./v8.x-v9.x/",
    "from-version-91x-to-92x": "./v9.1.x-v9.2.x/",
    "from-version-93x-to-94x": "./v9.3.x-v9.4.x/",
  };
  var anchor = window.location.hash.substring(1);
  if (anchor) {
    window.location.replace(anchorRedirects[anchor]);
  }
})();
</script>

# Plugin migration guides

The following guides help you identify the steps required to update a plugin following changes between versions of Grafana.

{{< section menuTitle="true">}}
