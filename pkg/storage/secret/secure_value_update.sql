UPDATE {{ .Ident "secure_value" }} SET
 "title"={{ .Arg .Row.Title }},
 "updated"={{ .Arg .Row.Updated }}, 
 "updated_by"={{ .Arg .Row.UpdatedBy }},
 "labels"={{ .Arg .Row.Labels }}, 
 "annotations"={{ .Arg .Row.Annotations }},
 "audiences"={{ .Arg .Row.Audiences }}
WHERE "uid"={{ .Arg .Row.UID }}
  AND "namespace"={{ .Arg .Row.Namespace }}
  AND "name"={{ .Arg .Row.Name }}
;