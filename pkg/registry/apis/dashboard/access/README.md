This implements a ResourceServer backed by the existing dashboard SQL tables.

There are a few oddities worth noting.  This is not a totally accurate implementation,
but it is good enough to drive the UI needs and let kubectl list work!

1. The resourceVersion is the dashboard version
  - each resource starts at 1 and increases
  - there are duplicate resourceVersions!
  - the resourceVersion is never set on the list commands

1. Results are always sorted by internal id ascending
  - this ensures everything is returned

1. The history objects have createdTimestamp == updatedTimestamp
  - not real, but good enough
