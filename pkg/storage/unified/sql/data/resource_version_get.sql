SELECT
        {{ .Ident "resource_version" | .Into .Response.ResourceVersion }},
        {{ .CurrentEpoch | .Into .Response.CurrentEpoch }}
    FROM {{ .Ident "resource_version" }}
    WHERE 1 = 1
        AND {{ .Ident "group" }}    = {{ .Arg .Group }}
        AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
    {{ if not .ReadOnly }}
    {{ .SelectFor "UPDATE" }}
    {{ end}}
;
