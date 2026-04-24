INSERT INTO dashboard_embeddings (
    "namespace",
    "model",
    "name",
    "subresource",
    "folder",
    "content",
    "metadata",
    "embedding"
)
VALUES (
    'stacks-123',
    'text-embedding-005',
    'abc-uid',
    'panel/5',
    'folder-uid',
    'panel title with queries',
    '[123 34 100 97 116 97 115 111 117 114 99 101 95 117 105 100 115 34 58 91 34 100 115 49 34 93 125]',
    '[0.1,0.2,0.3]'
)
ON CONFLICT ("namespace", "model", "name", "subresource")
DO UPDATE SET
    "folder"    = 'folder-uid',
    "content"   = 'panel title with queries',
    "metadata"  = '[123 34 100 97 116 97 115 111 117 114 99 101 95 117 105 100 115 34 58 91 34 100 115 49 34 93 125]',
    "embedding" = '[0.1,0.2,0.3]'
;
