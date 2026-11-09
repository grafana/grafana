DELETE FROM vector_promoted
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
      AND NOT EXISTS (
          SELECT 1 FROM embedding_collections c
          WHERE c.partition_key = vector_promoted.resource AND c.scope = 'shared'
      )
;
