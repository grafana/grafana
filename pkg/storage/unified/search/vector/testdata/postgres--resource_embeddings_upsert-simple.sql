INSERT INTO "resource_embeddings" (
    "namespace",
    "group",
    "resource",
    "name",
    "subresource",
    "resource_version",
    "folder",
    "content",
    "metadata",
    "embedding",
    "model"
)
VALUES (
    'stacks-123',
    'dashboard.grafana.app',
    'dashboards',
    'abc-uid',
    'panel/5',
    42,
    'folder-uid',
    'panel title with queries',
    '[123 34 100 97 116 97 115 111 117 114 99 101 95 117 105 100 115 34 58 91 34 100 115 49 34 93 125]',
    '[0.1,0.2,0.3]',
    'text-embedding-005'
)
ON CONFLICT ("namespace", "model", "group", "resource", "name", "subresource")
DO UPDATE SET
    "resource_version" = 42,
    "folder"           = 'folder-uid',
    "content"          = 'panel title with queries',
    "metadata"         = '[123 34 100 97 116 97 115 111 117 114 99 101 95 117 105 100 115 34 58 91 34 100 115 49 34 93 125]',
    "embedding"        = '[0.1,0.2,0.3]'
;
