SELECT p.id, p.uid, p.folder_uid,
  p.created, created_user.uid as created_by,
  p.updated, updated_user.uid as updated_by,
  p.name, p.type, p.description, p.model, p.version
  FROM "grafana"."library_element" as p
  LEFT OUTER JOIN "grafana"."user" AS created_user ON p.created_by = created_user.id
  LEFT OUTER JOIN "grafana"."user" AS updated_user ON p.updated_by = updated_user.id
  WHERE p.org_id = 1
    AND p.uid = 'xyz'
  ORDER BY p.id DESC
