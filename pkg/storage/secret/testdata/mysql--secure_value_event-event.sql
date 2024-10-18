INSERT INTO `secure_value_history` (
    "namespace", "name", 
    "ts", "action", "identity", "details"
  )
  VALUES (
    'ns', 'name',
    1234, 'UPDATE', 
    'user:ryan', 'aaa, bbb, ccc'
  )
;
