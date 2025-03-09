UPDATE {{ .Ident "resource_history" }}
SET {{ .Ident "resource_version" }} = (
    CASE
    {{ range $guid, $rv := .GUIDToRV }}
    WHEN {{ $.Ident "guid" }} = {{ $.Arg $guid }} THEN CAST({{ $.Arg $rv }} AS {{ if eq $.DialectName "postgres" }}BIGINT{{ else }}SIGNED{{ end }})
    {{ end }}
    END
)
WHERE {{ .Ident "guid" }} IN (
    {{$first := true}}
    {{ range $guid, $rv := .GUIDToRV }}{{if $first}}{{$first = false}}{{else}}, {{end}}{{ $.Arg $guid }}{{ end }}
);
