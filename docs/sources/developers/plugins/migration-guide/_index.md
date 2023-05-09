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
  // Previously all the migration docs were on a single page, and the different sections could be linked using URL hashes.
  var anchorRedirects = {
    "migrate-a-plugin-from-angular-to-react": "./angular-react/",
    "from-version-62x-to-740": "./v6.x-v7.x#from-version-62x-to-740",
    "from-version-65x-to-730": "./v6.x-v7.x#from-version-65x-to-730",
    "from-version-6xx-to-700": "./v6.x-v7.x/",
    "migrate-to-data-frames": "./v6.x-v7.x/",
    "troubleshoot-plugin-migration": "./v6.x-v7.x/",
    "from-version-7xx-to-8xx": "./v7.x-v8.x/",
    "from-version-83x-to-84x": "./v8.3.x-8.4.x/",
    "from-version-8x-to-9x": "./v8.x-v9.x/",
    "from-version-91x-to-92x": "./v9.1.x-v9.2.x/",
    "from-version-93x-to-94x": "./v9.3.x-9.4.x/",
  };
  var hash = window.location.hash.substring(1);
  var redirectTo = anchorRedirects[hash];
  if (redirectTo) {
    window.location.replace(redirectTo);
  }
})();
</script>

# Plugin migration guide

The following guides help you identify the steps required to update a plugin following changes between versions of Grafana.

{{< section menuTitle="true">}}
