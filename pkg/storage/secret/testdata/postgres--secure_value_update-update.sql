UPDATE "secure_value" SET
 "title"='ttt',
 "updated"=5678, 
 "updated_by"='user:cameron',
 "labels"='{"a":"AAA", "b", "BBBB"}', 
 "annotations"='{"x":"XXXX"}',
 "apis"='["aaa", "bbb", "ccc"]'
WHERE "uid"='uid'
  AND "namespace"='ns'
  AND "name"='name'
;
