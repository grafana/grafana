SELECT *
FROM {{ .Ident .ServerLockTable }}
WHERE operation_uid = {{ .Arg .OperationUID }}
{{ .SelectFor "UPDATE" }};
