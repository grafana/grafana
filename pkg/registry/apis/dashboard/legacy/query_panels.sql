SELECT p.id, p.uid, p.folder_uid,
	p.created, created_user.uid as created_by,
	p.updated, updated_user.uid as updated_by,
	p.name, p.type, p.description, p.model, p.version
  FROM {{ .Ident .LibraryElementTable }} as p
  LEFT OUTER JOIN {{ .Ident .UserTable }} AS created_user ON p.created_by = created_user.id
  LEFT OUTER JOIN {{ .Ident .UserTable }} AS updated_user ON p.updated_by = updated_user.id
  WHERE p.org_id = {{ .Arg .Query.OrgID }}
  {{ if .Query.LastID }}
    AND p.id > {{ .Arg .Query.LastID }}
  {{ end }}
  {{ if .Query.UID }}
    AND p.uid = {{ .Arg .Query.UID }}
  {{ end }}
  ORDER BY p.id DESC
  {{ if .Query.Limit }}
  LIMIT {{ .Arg .Query.Limit }}
  {{ end }}