SELECT uid, folder_uid
FROM "grafana"."dashboard" as u
WHERE u.org_id = 1 AND u.is_folder = false
