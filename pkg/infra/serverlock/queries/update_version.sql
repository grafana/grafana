UPDATE {{ .Ident .ServerLockTable }}
SET version = {{ .Arg .Version }},
    last_execution = {{ .Arg .LastExecution }}
WHERE operation_uid = {{ .Arg .OperationUID }}
  AND version = {{ .Arg .PreviousVersion }};
