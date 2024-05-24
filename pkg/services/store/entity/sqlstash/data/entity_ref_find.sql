SELECT {{ template "common_entity_select_into" . }}

    FROM
        {{ .Ident "entity_ref" }} AS r
            INNER JOIN
        {{ .Ident "entity" }} AS e
            ON r.{{ .Ident "guid" }} = e.{{ .Ident "guid" }}

    WHERE 1 = 1
        AND r.{{ .Ident "namespace" }}   = {{ .Arg .Request.Namespace }}
        AND r.{{ .Ident "group" }}       = {{ .Arg .Request.Group }}
        AND r.{{ .Ident "resource" }}    = {{ .Arg .Request.Resource }}
        AND r.{{ .Ident "resolved_to" }} = {{ .Arg .Request.Name }}
;
