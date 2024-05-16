INSERT INTO {{ .Ident "kind_version" }}
  (
    {{ .Ident "group" }},
    {{ .Ident "group_version" }},
    {{ .Ident "resource" }},
    {{ .Ident "resource_version" }}
  )

  VALUES (
    {{ .Arg .Group }},
    {{ .Arg .GroupVersion }},
    {{ .Arg .Resource }},
    1
  )
;
