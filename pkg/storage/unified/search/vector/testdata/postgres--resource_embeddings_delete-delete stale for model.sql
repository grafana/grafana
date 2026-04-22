DELETE FROM "resource_embeddings"
    WHERE "namespace" = 'stacks-123'
    AND "group"       = 'dashboard.grafana.app'
    AND "resource"    = 'dashboards'
    AND "name"        = 'abc-uid'
    AND "model" = 'text-embedding-005'
    AND "resource_version" < 42
;
