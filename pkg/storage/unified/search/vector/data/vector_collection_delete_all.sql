{{/* ctid is Postgres's physical row address. DELETE has no LIMIT, so paging
     selects one page of row addresses and deletes exactly those. SQL line
     comments can't be used here: FormatSQL collapses newlines and a -- would
     swallow the statement. */}}
DELETE FROM embeddings
    WHERE ctid IN (
        SELECT ctid FROM embeddings
        WHERE {{ .Ident "resource" }}  = {{ .Arg .Resource }}
        AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
        AND {{ .Ident "model" }}     = {{ .Arg .Model }}
        LIMIT {{ .Arg .Limit }}
    )
    AND {{ .Ident "resource" }}  = {{ .Arg .Resource }}
    AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "model" }}     = {{ .Arg .Model }}
;
