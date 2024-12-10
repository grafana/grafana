SELECT ou.role, u.is_admin
FROM "grafana"."user" as u
  JOIN "grafana"."org_user" as ou ON ou.user_id = u.id
WHERE ou.org_id = 1 AND u.id = 1
