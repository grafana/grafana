SELECT
    "name",
    "subresource",
    "content",
    "embedding" <=> '[0.1 0.2 0.3]' AS "score",
    "folder",
    "metadata"
    FROM "resource_embeddings"
    WHERE "namespace" = 'stacks-123'
    AND "model"       = 'text-embedding-005'
    AND "group"       = 'dashboard.grafana.app'
    AND "resource"    = 'dashboards'
    AND "name" IN ('dash-1')
    AND "folder" IN ('folder-a', 'folder-b')
    AND "metadata" @> '{"datasource_uids":["ds-uid-1"]}'
    AND "metadata" @> '{"query_languages":["promql"]}'
    ORDER BY "embedding" <=> '[0.1 0.2 0.3]'
    LIMIT 5
;
