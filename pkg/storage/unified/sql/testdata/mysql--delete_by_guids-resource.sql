DELETE FROM `resource`
WHERE `namespace` = 'ns'
  AND `group` = 'group'
  AND `resource` = 'res'
  AND `guid` IN ('guid1', 'guid2', 'guid3');
