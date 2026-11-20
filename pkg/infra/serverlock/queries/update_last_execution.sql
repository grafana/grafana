UPDATE {{ .Ident .ServerLockTable }}
SET last_execution = {{ .Arg .LastExecution }}
WHERE operation_uid = {{ .Arg .OperationUID }};
