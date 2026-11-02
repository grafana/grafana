DELETE FROM embeddings
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
      AND NOT EXISTS (
          SELECT 1 FROM embedding_collections c
          WHERE c.partition_key = embeddings.resource AND c.scope = 'shared'
      )
;
