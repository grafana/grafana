INSERT INTO "secure_value" (
    "uid", 
    "namespace", "name", "title",
    "manager", "path",
    "encrypted_provider", "encrypted_kid", 
    "encrypted_salt", "encrypted_value", "encrypted_time",
    "created", "created_by",
    "updated", "updated_by",
    "annotations", "labels", 
    "apis"
  )
  VALUES (
    'abc',
    'ns', 'name', 'title',
    'default', 'path',
    'awskms', 'KeyID', 
    'TheSalt', 'EncryptedValue', 5678,
    1234, 'user:ryan',
    5678, 'user:cameron',
    '{"x":"XXXX"}', '{"a":"AAA", "b", "BBBB"}',
    '["aaa", "bbb", "ccc"]'
  )
;
