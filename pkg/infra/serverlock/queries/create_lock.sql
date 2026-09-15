INSERT INTO {{ .Ident .ServerLockTable }} (operation_uid, last_execution, version)
VALUES ({{ .Arg .OperationUID }}, {{ .Arg .LastExecution }}, {{ .Arg .Version }}){{ if eq .DialectName "postgres" }} ON CONFLICT DO NOTHING RETURNING id{{ end }};
