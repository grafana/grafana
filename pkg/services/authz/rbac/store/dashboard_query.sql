SELECT uid, folder_uid
FROM {{ .Ident .DashboardTable }} as u
WHERE u.org_id = {{ .Arg .Query.OrgID }} AND u.is_folder = false
