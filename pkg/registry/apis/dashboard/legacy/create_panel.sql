INSERT INTO {{ .Ident .LibraryElementTable }} (
  org_id, folder_id, folder_uid, uid, name, kind, type, description, model, version, created, created_by, updated, updated_by
) 
SELECT 
  {{ .Arg .Query.OrgID }},
  {{ .Arg .Query.FolderID }},
  {{ .Arg .Query.FolderUID }},
  {{ .Arg .Query.UID }},
  {{ .Arg .Query.Name }},
  {{ .Arg .Query.Kind }},
  {{ .Arg .Query.Type }},
  {{ .Arg .Query.Description }},
  {{ .Arg .Query.Model }},
  {{ .Arg .Query.Version }},
  {{ .Arg .Query.Created }},
  created_user.id,
  {{ .Arg .Query.Updated }},
  created_user.id
FROM {{ .Ident .UserTable }} as created_user
WHERE created_user.uid = {{ .Arg .Query.CreatedBy }}