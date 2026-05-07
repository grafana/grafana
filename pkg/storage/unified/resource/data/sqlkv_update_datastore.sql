UPDATE {{ .Ident .TableName }}
SET {{ .Ident "value" }} = {{ .Arg .Value }}
WHERE {{ .Ident "key_path" }} = {{ .Arg .KeyPath }};
