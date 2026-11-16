DELETE FROM embeddings
    WHERE "namespace" = 'stacks-123'
      AND NOT EXISTS (
          SELECT 1 FROM embedding_collections c
          WHERE c.partition_key = embeddings.resource AND c.scope = 'shared'
      )
;
