INSERT INTO `resource_blob`
  (
    `uuid`, 
    `created`,
    `group`,
    `resource`,
    `namespace`,
    `name`,
    `value`,
    `hash`,
    `content_type`
  )
  VALUES (
    'abc', 
    '2023-12-31 21:00:00 +0000 UTC', 
    'g',
    'r',
    'x',
    'name',
    '[97 98 99 100 101 102 103]',
    'xxx',
    'text/plain'
  )
;
