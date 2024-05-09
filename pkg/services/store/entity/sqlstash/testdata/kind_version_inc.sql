UPDATE "kind_version"
  SET "resource_version" = ? + 1
  WHERE 1 = 1
    AND "group"            = ?
    AND "group_version"    = ?
    AND "resource"         = ?
    AND "resource_version" = ?
;
