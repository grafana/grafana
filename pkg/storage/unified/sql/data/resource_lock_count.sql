SELECT
    COUNT({{ "*" | .Into .Response.Count }}) AS count
    FROM {{ .Ident "resource_lock" }}
    WHERE 1 = 1
    AND {{ .Ident "group" }}     = {{ .Arg .Group }}
    AND {{ .Ident "resource" }}  = {{ .Arg .Resource }}
;
