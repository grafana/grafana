    INSERT INTO "resource_last_import_time" (
       "group",
       "resource",
       "namespace",
       "last_import_time"
     ) VALUES (
       'group',
       'res',
       'ns',
       '2025-10-07 22:30:05 +0000 UTC'
    ) ON CONFLICT ("group", "resource", "namespace")
      DO UPDATE SET "last_import_time" = '2025-10-07 22:30:05 +0000 UTC'
;
