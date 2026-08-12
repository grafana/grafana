UPDATE {{ .Ident "resource_history" }}
SET
  {{ .Ident "previous_resource_version" }} = {{ .Arg .PreviousRV }},
  {{ .Ident "generation" }} = {{ .Arg .Generation }}
 WHERE {{ .Ident "guid" }} = {{ .Arg .GUID }};
