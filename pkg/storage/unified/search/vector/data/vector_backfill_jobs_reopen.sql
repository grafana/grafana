UPDATE vector_backfill_jobs
    SET {{ .Ident "is_complete" }}     = FALSE,
        {{ .Ident "content_version" }} = {{ .Arg .Version }},
        {{ .Ident "stopping_rv" }}      = {{ .Arg .StoppingRV }},
        {{ .Ident "last_seen_key" }}    = NULL,
        {{ .Ident "last_error" }}       = NULL,
        {{ .Ident "updated_at" }}       = CURRENT_TIMESTAMP
    WHERE {{ .Ident "model" }} = {{ .Arg .Model }}
      AND {{ .Ident "resource" }} IN ({{ .Arg .Resource }}, {{ .Arg "" }})
      AND {{ .Ident "content_version" }} < {{ .Arg .Version }}
;
