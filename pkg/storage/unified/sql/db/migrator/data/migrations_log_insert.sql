INSERT INTO {{ .Ident .MigrationsLogTableName }} (
        {{ .Ident "id" }},
        {{ .Ident "version" }},
        {{ .Ident "ts" }},
        {{ .Ident "is_up" }},
        {{ .Ident "is_dirty" }},
        {{ .Ident "statements" }},
        {{ .Ident "error" }}
    ) VALUES (
        {{ .Arg .ID }},
        {{ .Arg .Index }},
        {{ .Arg .Timestamp }},
        {{ .Arg .IsUp }},
        {{ .Arg .IsDirty }},
        {{ .Arg .Error }},
        {{ .Arg .Statements }}
    )
