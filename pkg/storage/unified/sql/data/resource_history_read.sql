SELECT
    {{ .Ident "resource_version" | .Into .ResourceVersion }},
    {{ .Ident "value" | .Into .Value }}

    FROM {{ .Ident "resource_history" }}

    WHERE 1 = 1
        AND {{ .Ident "namespace" }} = {{ .Arg .Request.Key.Namespace }}
        AND {{ .Ident "group" }}     = {{ .Arg .Request.Key.Group }}
        AND {{ .Ident "resource" }}  = {{ .Arg .Request.Key.Resource }}
        AND {{ .Ident "name" }}      = {{ .Arg .Request.Key.Name }}
      {{ if gt .Request.ResourceVersion 0 }}
        AND {{ .Ident "resource_version" }} <= {{ .Arg .Request.ResourceVersion }}
      {{ end }}
    ORDER BY {{ .Ident "resource_version" }} DESC
    LIMIT 1
;
