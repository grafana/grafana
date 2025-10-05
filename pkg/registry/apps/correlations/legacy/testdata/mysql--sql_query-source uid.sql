SELECT c.uid,c.org_id,c.type,c.config,c.description,c.label,c.provisioned,
 src.`type` as src_type, src.uid as src_uid,
 tgt.`type` as tgt_type, tgt.uid as tgt_uid
 FROM `grafana`.`correlation` AS c
 LEFT JOIN `grafana`.`data_source` AS src ON c.source_uid = src.uid
 LEFT JOIN `grafana`.`data_source` AS tgt ON c.target_uid = tgt.uid
WHERE c.org_id=1
   AND src.uid IN ('a')
