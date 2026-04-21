SELECT u.uid
FROM "grafana"."user" as u
INNER JOIN "grafana"."org_user" as ou ON ou.user_id = u.id AND ou.org_id = 1
WHERE u.id = 99
AND u.is_service_account = FALSE
LIMIT 1;
