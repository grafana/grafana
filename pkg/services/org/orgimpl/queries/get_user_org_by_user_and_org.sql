SELECT org.name, org_user.role, org_user.org_id
FROM {{ .Ident .OrgUserTable }} AS org_user
INNER JOIN {{ .Ident .OrgTable }} AS org ON org_user.org_id = org.id
WHERE org_user.user_id = {{ .Arg .UserID }}
  AND org_user.org_id = {{ .Arg .OrgID }}
