SELECT org.name, org_user.role, org_user.org_id
FROM {{ .Ident .OrgUserTable }} AS org_user
INNER JOIN {{ .Ident .OrgTable }} AS org ON org_user.org_id = org.id
INNER JOIN {{ .Ident .UserTable }} AS u ON org_user.user_id = u.id
WHERE org_user.user_id = {{ .Arg .UserID }}
  AND u.is_service_account = {{ .Arg .IsServiceAccount }}
ORDER BY org.name
