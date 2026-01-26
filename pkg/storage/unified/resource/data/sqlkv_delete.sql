DELETE
FROM {{ .Ident .TableName }}
WHERE {{ .Ident "key_path" }} = {{ .Arg .KeyPath }};
