SELECT COALESCE(ou.role, 'None') AS role, u.is_admin
FROM `grafana`.`user` as u
  LEFT JOIN `grafana`.`org_user` as ou ON ou.user_id = u.id AND ou.org_id = 1
WHERE u.id = 1
