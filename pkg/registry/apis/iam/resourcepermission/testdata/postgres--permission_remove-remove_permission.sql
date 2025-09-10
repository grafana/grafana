DELETE FROM "grafana"."permission" AS p
WHERE p.scope = 'folders:uid:folder1'
AND p.role_id = (
    SELECT r.id
    FROM "grafana"."role" AS r
    WHERE r.org_id = 55
    AND r.name = 'managed:users:1:permissions'
    LIMIT 1
)
