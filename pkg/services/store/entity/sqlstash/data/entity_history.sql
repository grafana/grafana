SELECT {{ template "common_entity_select_into" . }}

    FROM {{ .Ident "entity_history" }} AS e

    WHERE 1 = 1

        {{ if gt .Before 0 }}
            AND {{ .Ident "resource_version" }} < {{ .Arg .Before }}
        {{ end }}

        {{/* There are two mutually exclusive search modes: by GUID and by Key */}}

        {{ if ne .Query.GUID "" }}
            AND {{ .Ident "guid" }} = {{ .Arg .Query.GUID }}

        {{ else }}
            AND {{ .Ident "group" }}    = {{ .Arg .Query.Key.Group }}
            AND {{ .Ident "resource" }} = {{ .Arg .Query.Key.Resource }}
            AND {{ .Ident "name" }}     = {{ .Arg .Query.Key.Name }}

            {{ if ne .Query.Key.Namespace "" }}
                AND {{ .Ident "namespace" }} = {{ .Arg .Query.Key.Namespace }}
            {{ end }}

        {{ end }}

    ORDER BY {{ template "common_order_by" . }}
    LIMIT    {{ .Limit }}
    OFFSET   {{ .Offset }}
;
