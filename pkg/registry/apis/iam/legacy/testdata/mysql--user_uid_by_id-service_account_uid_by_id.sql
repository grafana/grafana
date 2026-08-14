SELECT u.uid
FROM `grafana`.`user` as u
INNER JOIN `grafana`.`org_user` as ou ON ou.user_id = u.id AND ou.org_id = 1
WHERE u.id = 55
AND u.is_service_account = TRUE
LIMIT 1;
