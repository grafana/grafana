DELETE FROM `secret_keeper`
  WHERE 1 = 1 AND
    `namespace` = 'ns' AND
    `name`      = 'name'
;
