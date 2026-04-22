DELETE FROM "resource_embeddings"
    WHERE "namespace" = 'stacks-123'
    AND "group"       = 'dashboard.grafana.app'
    AND "resource"    = 'dashboards'
    AND "name"        = 'abc-uid'
;
