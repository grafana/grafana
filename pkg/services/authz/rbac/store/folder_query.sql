SELECT uid, parent_uid
FROM {{ .Ident .FolderTable }} as u
WHERE u.org_id = {{ .Arg .Query.OrgID }}
