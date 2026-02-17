INSERT INTO {{ .Ident "secret_consolidation_history" }} (
  {{ .Ident "created" }},
  {{ .Ident "completed" }}
) VALUES (
  {{ .Arg .Created }},
  {{ .Arg .Completed }}
);
