CREATE TABLE IF NOT EXISTS {{ .PartitionName }}
    PARTITION OF {{ .Ident "resource_embeddings" }}
    FOR VALUES IN ({{ .NamespaceLiteral }})
;
