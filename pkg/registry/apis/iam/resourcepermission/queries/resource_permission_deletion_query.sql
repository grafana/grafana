DELETE FROM {{ .Ident .PermissionTable }} p
WHERE p.scope = {{ .Arg .Query.Scope }}
  AND p.role_id IN (
    SELECT r.id
    FROM {{ .Ident .RoleTable }} r
    WHERE r.name LIKE {{ .Arg .ManagedRolePattern }}
      AND r.org_id = {{ .Arg .Query.OrgID }}
  )
