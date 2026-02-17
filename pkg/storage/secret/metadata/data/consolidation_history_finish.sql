UPDATE {{ .Ident "secret_consolidation_history" }}
SET {{ .Ident "completed" }} = {{ .Arg .Completed }}
WHERE {{ .Ident "id" }} = {{ .Arg .ID }}
  AND {{ .Ident "completed" }} = 0
;
