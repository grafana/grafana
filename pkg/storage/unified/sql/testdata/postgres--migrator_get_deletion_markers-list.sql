SELECT
    "guid",
    "value",
    "group",
    "resource",
    "previous_resource_version"
 FROM "resource_history"
WHERE "action" = 3
  AND "value" LIKE '{"kind":"DeletedMarker"%';
