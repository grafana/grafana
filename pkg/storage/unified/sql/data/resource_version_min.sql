SELECT
        COALESCE(MIN({{ .Ident "resource_version" | .Into .Response.ResourceVersion }}), 0)
        {{ .CurrentEpoch | .Into .Response.CurrentEpoch }}
    FROM {{ .Ident "resource_version" }}
    WHERE 1 = 1
        AND {{ .Ident "group" }}    = {{ .Arg .Group }}
        AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
;
