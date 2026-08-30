SELECT
    {{ .Ident "id"            | .Into .Response.ID }},
    {{ .Ident "model"         | .Into .Response.Model }},
    {{ .Ident "resource"      | .Into .Response.Resource }},
    {{ .Ident "stopping_rv"   | .Into .Response.StoppingRV }},
    {{ .Ident "last_seen_key" | .Into .Response.LastSeenKey }},
    {{ .Ident "is_complete"   | .Into .Response.IsComplete }},
    {{ .Ident "last_error"    | .Into .Response.LastError }}
    FROM vector_backfill_jobs
    WHERE {{ .Ident "is_complete" }} = FALSE
      AND {{ .Ident "model" }} = {{ .Arg .Model }}
    ORDER BY {{ .Ident "id" }}
;
