SELECT {{ .Ident "value" }}
  FROM {{ .Ident "resource_history" }}
 WHERE {{ .Ident "group"    }} = {{ .Arg .Group }}
   AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
   AND {{ .Ident "resource_version" }} = {{ .Arg .RV }};