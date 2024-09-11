SELECT
    dashboard.org_id, dashboard.id,
    dashboard.uid, dashboard.folder_uid,
    dashboard.deleted, plugin_id,
    dashboard_provisioning.name         as origin_name,
    dashboard_provisioning.external_id  as origin_path,
    dashboard_provisioning.check_sum    as origin_key,
    dashboard_provisioning.updated      as origin_ts,
    dashboard.created, created_user.uid as created_by, dashboard.created_by   as created_by_id,
    dashboard.updated, updated_user.uid as updated_by, dashboard.updated_by   as updated_by_id,
    dashboard.version, '' as message, dashboard.data
    FROM dashboard
    LEFT OUTER JOIN dashboard_provisioning ON dashboard.id = dashboard_provisioning.dashboard_id
    LEFT OUTER JOIN "user" AS created_user ON dashboard.created_by = created_user.id
    LEFT OUTER JOIN "user" AS updated_user ON dashboard.updated_by = updated_user.id
    WHERE dashboard.is_folder = false
      AND dashboard.org_id = ?
        AND dashboard.uid = ?
    ORDER BY dashboard.id DESC
