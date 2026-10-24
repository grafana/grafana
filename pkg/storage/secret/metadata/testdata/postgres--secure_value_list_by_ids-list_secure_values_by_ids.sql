SELECT
  "guid",
  "gc_attempts",
  "namespace",
  "name",
  "version"
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
