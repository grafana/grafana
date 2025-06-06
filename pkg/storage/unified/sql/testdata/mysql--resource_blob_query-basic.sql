SELECT
  `uuid`,
  `value`,
  `content_type`
FROM `resource_blob`
WHERE 1 = 1
  AND `namespace` = 'x'
  AND `group`     = 'g'
  AND `resource`  = 'r'
  AND `name`      = 'name'
  AND `uuid`      = 'abc'
ORDER BY `created` DESC
LIMIT 1;
