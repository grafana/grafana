SELECT
  "guid",
  "gc_attempts"
FROM
  "secret_secure_value"
WHERE
   ("namespace", "name", "version") IN
  (
      (
        'ns1',
        'n1',
        2
      )
  );
