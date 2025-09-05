SELECT MAX(updated) AS updated
FROM (
  (SELECT id, updated FROM {{ .Ident .BuiltinRoleTable }} br
    WHERE br.org_id = {{ .Arg .Query.OrgID }}
    ORDER BY id DESC LIMIT 1
  )
  UNION ALL
  (SELECT id, created as updated FROM {{ .Ident .UserRoleTable }} ur
    WHERE ur.org_id = {{ .Arg .Query.OrgID }}
    ORDER BY id DESC LIMIT 1
  )
  UNION ALL
  (SELECT id, created as updated FROM {{ .Ident .TeamRoleTable }} tr
    WHERE tr.org_id = {{ .Arg .Query.OrgID }}
    ORDER BY id DESC LIMIT 1
  )
  UNION ALL
  (SELECT id, updated FROM {{ .Ident .PermissionTable }} p
    WHERE p.org_id = {{ .Arg .Query.OrgID }}
    ORDER BY id DESC LIMIT 1
  )
) AS u;
