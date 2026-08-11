INSERT INTO vector_backfill_jobs
    ({{ .Ident "model" }}, {{ .Ident "resource" }}, {{ .Ident "stopping_rv" }}, {{ .Ident "is_complete" }}, {{ .Ident "content_version" }})
    VALUES ({{ .Arg .Model }}, {{ .Arg .Resource }}, {{ .Arg .StoppingRV }}, FALSE, {{ .Arg .ContentVersion }})
    ON CONFLICT ({{ .Ident "model" }}, {{ .Ident "resource" }}) DO NOTHING
;
