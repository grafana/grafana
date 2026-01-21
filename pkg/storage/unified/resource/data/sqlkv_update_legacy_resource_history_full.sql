UPDATE {{ .Ident "resource_history" }}
SET
  {{ .Ident "action" }} = {{ .Arg .Action }},
  {{ .Ident "previous_resource_version" }} = {{ .Arg .PreviousRV }},
  {{ .Ident "generation" }} = {{ .Arg .Generation }}
WHERE {{ .Ident "guid" }} = {{ .Arg .GUID }};
