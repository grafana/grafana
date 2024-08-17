SELECT
        {{ .Ident "id"         | .Into .Entry.ID }},
        {{ .Ident "version"    | .Into .Entry.Index }},
        {{ .Ident "ts"         | .Into .Entry.Timestamp }},
        {{ .Ident "is_up"      | .Into .Entry.IsUp }},
        {{ .Ident "is_dirty"   | .Into .Entry.Succeeded }},
        {{ .Ident "error"      | .Into .Entry.Error }},
        {{ .Ident "statements" | .Into .Entry.Statements }}
    FROM {{ .Ident .MigrationsLogTableName }}
    WHERE
        {{ .Ident "ts" }} = (
            SELECT max({{ .Ident "ts" }})
                FROM {{ .Ident .MigrationsLogTableName }}
        )
