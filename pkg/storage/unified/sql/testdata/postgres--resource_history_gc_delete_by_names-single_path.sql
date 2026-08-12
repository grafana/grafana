DELETE FROM "resource_history"
WHERE "group" = 'group'
  AND "resource" = 'res'
  AND ("namespace", "name") IN (('ns1', 'name1'))
  AND NOT EXISTS (
    SELECT 1 FROM "resource" r
    WHERE r."namespace" = "resource_history"."namespace"
      AND r."group" = "resource_history"."group"
      AND r."resource" = "resource_history"."resource"
      AND r."name" = "resource_history"."name"
  );
