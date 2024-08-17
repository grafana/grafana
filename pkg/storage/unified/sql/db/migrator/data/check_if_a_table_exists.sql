SELECT COUNT(*)
    FROM
{{ if eq .DialectName "sqlite" }}
      {{ .Ident "sqlite_master" }}
    WHERE 1 = 1
        AND {{ .Ident "type" }} = 'table'
        AND {{ .Ident "name" }} = {{ .Arg .TableName }}

{{ else }}
        {{ .Ident "information_schema" }}.{{ .Ident "tables" }}
    WHERE 1 = 1
        AND {{ .Ident "table_name" }} = {{ .Arg .TableName }}
        AND {{ .Ident "table_schema" }} =
            {{ if eq .DialectName "mysql" }}
                database()
            {{ else }}
                current_schema
            {{ end }}
{{ end }}
