SELECT {{ .Ident "value" | .Into .Value }}
FROM {{ .Ident .TableName }}
WHERE {{ .Ident "key_path" }} = {{ .Arg .KeyPath }};
