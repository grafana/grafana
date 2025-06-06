DELETE FROM "resource_history"
WHERE "guid" IN (
  SELECT "guid"
  FROM (
  SELECT
    "guid",
    ROW_NUMBER() OVER (
      PARTITION BY "namespace"
        , "group"
        , "resource"
        , "name"
        , "generation"
      ORDER BY "resource_version" DESC
    ) AS "rn"
  FROM "resource_history"
  WHERE "namespace" = 'default'
    AND "group" = 'provisioning.grafana.app'
    AND "resource" = 'repositories'
    AND "name" = 'repo-xyz'
    AND "generation" > 0
  ) AS "ranked"
  WHERE "rn" > 1
);
