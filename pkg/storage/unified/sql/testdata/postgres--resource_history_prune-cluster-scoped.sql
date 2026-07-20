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
      ORDER BY "resource_version" DESC
    ) AS "rn"
  FROM "resource_history"
  WHERE "namespace" = ''
    AND "group" = 'cluster.example.io'
    AND "resource" = 'clusterresources'
    AND "name" = 'my-cluster-resource'
  ) AS "ranked"
  WHERE "rn" > 10
);
