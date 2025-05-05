SELECT u.id
FROM "grafana"."user" as u
INNER JOIN "grafana"."org_user" as o ON u.id = o.user_id
WHERE o.org_id = 1
AND u.uid = 'sa-1'
AND u.is_service_account
LIMIT 1;
