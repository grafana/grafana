DELETE FROM 
  `secret_secure_value`
WHERE 
  (`namespace`, `name`, `version`) IN
  (
      (
        'a',
        'b',
        'c'
      )
        ,
      (
        'd',
        'e',
        'f'
      )
  );
