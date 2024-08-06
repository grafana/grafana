SELECT
    "dashboard.org_id", "dashboard.id",
    "dashboard.uid", "dashboard.folder_uid",
    "dashboard.created", "created_user.uid as created_by",
    "dashboard_version.created", "updated_user.uid as updated_by",
    NULL, "plugin_id",
    "dashboard_provisioning.name as origin_name",
    "dashboard_provisioning.external_id as origin_path",
    "dashboard_provisioning.check_sum as origin_key",
    "dashboard_provisioning.check_sum as origin_key",
    "dashboard_provisioning.updated as origin_ts",
    "dashboard_version.version", 
    "dashboard_version.message", 
    "dashboard_version.data"
    FROM "dashboard"
    LEFT OUTER JOIN "dashboard_provisioning" ON "dashboard.id" = "dashboard_provisioning.dashboard_id"
    LEFT OUTER JOIN `user` AS created_user ON "dashboard.created_by" = "created_user.id"
    LEFT OUTER JOIN `user` AS updated_user ON "dashboard_version.created_by" = "updated_user.id"
    WHERE "dashboard.uid" = ?
	    AND "dashboard.org_id" = ?
    
    ORDER BY "dashboard_version.version" DESC
