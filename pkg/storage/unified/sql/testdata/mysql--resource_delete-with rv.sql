DELETE FROM `resource`
  WHERE 1 = 1
    AND `namespace` = 'nn'
    AND `group`     = 'gg'
    AND `resource`  = 'rr'
    AND `name`      = 'name'
    AND `resource_version` = 1234
;
