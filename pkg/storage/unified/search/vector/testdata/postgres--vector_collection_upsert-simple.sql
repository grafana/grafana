INSERT INTO embeddings (
    "resource",
    "namespace",
    "model",
    "uid",
    "title",
    "subresource",
    "folder",
    "content",
    "metadata",
    "embedding",
    "content_version",
    "ts"
)
VALUES (
    'dashboards',
    'stacks-123',
    'text-embedding-005',
    'abc-uid',
    'CPU Dashboard',
    'panel/5',
    'folder-uid',
    'panel title with queries',
    '{"datasource_uids":["ds1"]}',
    '[0.1,0.2,0.3]',
    3,
    NULL
)
ON CONFLICT ("resource", "namespace", "model", "uid", "subresource")
DO UPDATE SET
    "title"           = 'CPU Dashboard',
    "folder"          = 'folder-uid',
    "content"         = 'panel title with queries',
    "metadata"        = '{"datasource_uids":["ds1"]}',
    "embedding"       = '[0.1,0.2,0.3]',
    "content_version" = 3,
    "ts"              = EXCLUDED."ts",
    "updated_at"      = CURRENT_TIMESTAMP
;
