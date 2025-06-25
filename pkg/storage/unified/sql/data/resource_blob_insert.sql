INSERT INTO {{ .Ident "resource_blob" }}
  (
    {{ .Ident "uuid" }}, 
    {{ .Ident "created" }},
    {{ .Ident "group" }},
    {{ .Ident "resource" }},
    {{ .Ident "namespace" }},
    {{ .Ident "name" }},

    {{ .Ident "value" }},
    {{ .Ident "hash" }},
    {{ .Ident "content_type" }}
  )
  VALUES (
    {{ .Arg .Info.UID }}, 
    {{ .Arg .Now }}, 
    {{ .Arg .Key.Group }},
    {{ .Arg .Key.Resource }},
    {{ .Arg .Key.Namespace }},
    {{ .Arg .Key.Name }},

    {{ .Arg .Value }},
    {{ .Arg .Info.Hash }},
    {{ .Arg .ContentType }}
  )
;