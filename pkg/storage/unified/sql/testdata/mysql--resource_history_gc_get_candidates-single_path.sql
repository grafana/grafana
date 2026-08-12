SELECT DISTINCT `namespace`,
                `name`
FROM `resource_history` h
WHERE h.`group` = 'group'
  AND h.`resource` = 'res'
  AND h.`action` = 3
  AND h.`resource_version` < 123456
  AND NOT EXISTS (
    SELECT 1 FROM `resource` r
    WHERE r.`namespace` = h.`namespace`
      AND r.`group` = h.`group`
      AND r.`resource` = h.`resource`
      AND r.`name` = h.`name`
  )
LIMIT 100;
