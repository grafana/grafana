SELECT setval('"test_schema"."org_id_seq"'::regclass, (SELECT max(id) FROM "test_schema"."org"));
