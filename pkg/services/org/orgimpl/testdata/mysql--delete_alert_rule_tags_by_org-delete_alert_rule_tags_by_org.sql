DELETE FROM `test_schema`.`alert_rule_tag`
WHERE EXISTS (
  SELECT 1
  FROM `test_schema`.`alert` AS alert
  WHERE alert.org_id = 7
    AND alert.id = alert_rule_tag.alert_id
)
