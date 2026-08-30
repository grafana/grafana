DELETE FROM 
  "secret_secure_value"
WHERE 
  ("namespace", "name", "version") IN
  (
      (
        'a',
        'b',
        1
      )
        ,
      (
        'd',
        'e',
        2
      )
  );
