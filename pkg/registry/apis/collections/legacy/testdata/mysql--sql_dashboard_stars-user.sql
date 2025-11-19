SELECT s.org_id, u.uid as user_uid, s.dashboard_uid, s.updated 
  FROM `grafana`.`star` as s 
  JOIN `grafana`.`user` as u ON s.user_id = u.id
WHERE s.org_id = 3 
  AND u.uid = 'abc'
ORDER BY 
  s.org_id asc, s.user_id asc, s.updated asc 
