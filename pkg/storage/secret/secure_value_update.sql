UPDATE {{ .Ident "secure_value" }} SET
 "title"={{ .Arg .Row.Title }},
 "updated"={{ .Arg .Row.Updated }}, 
 "updated_by"={{ .Arg .Row.UpdatedBy }},
 "labels"={{ .Arg .Row.Labels }}, 
 "annotations"={{ .Arg .Row.Annotations }},
 "apis"={{ .Arg .Row.APIs }}
WHERE "uid"={{ .Arg .Row.UID }}
  AND "namespace"={{ .Arg .Row.Namespace }}
  AND "name"={{ .Arg .Row.Name }}
;