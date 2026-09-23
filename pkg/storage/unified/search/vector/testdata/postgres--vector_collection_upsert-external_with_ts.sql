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
    'alertrules_external',
    'stacks-123',
    'text-embedding-005',
    'rule-1',
    'CPU Alert',
    'chunk/0',
    '',
    'cpu usage high',
    '[123 34 107 105 110 100 34 58 34 97 108 101 114 116 95 114 117 108 101 34 125]',
    '[0.1,0.2,0.3]',
    0,
    to_tsvector('english', 'cpu usage high')
)
ON CONFLICT ("resource", "namespace", "model", "uid", "subresource")
DO UPDATE SET
    "title"           = 'CPU Alert',
    "folder"          = '',
    "content"         = 'cpu usage high',
    "metadata"        = '[123 34 107 105 110 100 34 58 34 97 108 101 114 116 95 114 117 108 101 34 125]',
    "embedding"       = '[0.1,0.2,0.3]',
    "content_version" = 0,
    "ts"              = EXCLUDED."ts",
    "updated_at"      = CURRENT_TIMESTAMP
;
