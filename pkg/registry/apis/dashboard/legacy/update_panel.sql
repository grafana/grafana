UPDATE {{ .Ident .LibraryElementTable }} as le
JOIN {{ .Ident .UserTable }} as updated_user ON updated_user.uid = {{ .Arg .Query.UpdatedBy }}
SET 
  le.folder_id = {{ .Arg .Query.FolderID }},
  le.folder_uid = {{ .Arg .Query.FolderUID }},
  le.name = {{ .Arg .Query.Name }},
  le.kind = {{ .Arg .Query.Kind }},
  le.type = {{ .Arg .Query.Type }},
  le.description = {{ .Arg .Query.Description }},
  le.model = {{ .Arg .Query.Model }},
  le.version = {{ .Arg .Query.Version }},
  le.updated = {{ .Arg .Query.Updated }},
  le.updated_by = updated_user.id
WHERE le.org_id = {{ .Arg .Query.OrgID }} AND le.uid = {{ .Arg .Query.UID }} 