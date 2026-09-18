DELETE FROM {{ .Ident .ServerLockTable }}
WHERE operation_uid = {{ .Arg .OperationUID }};
