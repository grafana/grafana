INSERT INTO vector_backfill_jobs
    ({{ .Ident "model" }}, {{ .Ident "resource" }}, {{ .Ident "stopping_rv" }}, {{ .Ident "is_complete" }})
    VALUES ({{ .Arg .Model }}, {{ .Arg .Resource }}, {{ .Arg .StoppingRV }}, FALSE)
    ON CONFLICT ({{ .Ident "model" }}, {{ .Ident "resource" }}) DO NOTHING
;
