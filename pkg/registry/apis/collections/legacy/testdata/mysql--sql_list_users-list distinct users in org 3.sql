SELECT DISTINCT(u.uid) 
  FROM `grafana`.`star` as s 
  JOIN `grafana`.`user` as u ON s.user_id = u.id
 WHERE s.org_id = 3
