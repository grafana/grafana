SELECT
    `namespace`,
    `group`,
    `resource`,
    `name`,
    `resource_version`,
    `action`,
    `value`
FROM resource_history
WHERE `namespace` = 'ns'
  AND `group` = 'group'
  AND `resource` = 'res'
  AND `resource_version` > 10000 -- needs to be exclusive of the sinceRv
ORDER BY `name` ASC, `resource_version` DESC
