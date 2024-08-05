SELECT
    {{ .Ident "dashboard.org_id" }}, {{ .Ident "dashboard.id" }},
    {{ .Ident "dashboard.uid" }}, {{ .Ident "dashboard.folder_uid" }},
    FROM {{ .Ident "dashboard" }}
    WHERE {{ .Ident "dashboard.is_folder" }} = false
        {{ if and .Request.Options .Request.Options.Key }}
            {{ if .Request.Options.Key.Namespace }}
            AND {{ .Ident "namespace" }} = {{ .Arg .Request.Options.Key.Namespace }}
            {{ end }}
            {{ if .Request.Options.Key.Group }}
            AND {{ .Ident "group" }}     = {{ .Arg .Request.Options.Key.Group }}
            {{ end }}
            {{ if .Request.Options.Key.Resource }}
            AND {{ .Ident "resource" }}  = {{ .Arg .Request.Options.Key.Resource }}
            {{ end }}
            {{ if .Request.Options.Key.Name }}
            AND {{ .Ident "name" }}      = {{ .Arg .Request.Options.Key.Name }}
            {{ end }}
        {{ end }}
    ORDER BY {{ .Ident "namespace" }} ASC, {{ .Ident "name" }} ASC
;


-- SELECT
-- 			, ,
-- 			
-- 			dashboard.created,created_user.uid as created_by,
-- 			dashboard_version.created,updated_user.uid as updated_by,
-- 			NULL, plugin_id,
-- 			dashboard_provisioning.name as origin_name,
-- 			dashboard_provisioning.external_id as origin_path,
-- 			dashboard_provisioning.check_sum as origin_key,
-- 			dashboard_provisioning.updated as origin_ts,
-- 			dashboard_version.version, dashboard_version.message, dashboard_version.data
-- 		FROM dashboard
-- 		LEFT OUTER JOIN dashboard_provisioning ON dashboard.id = dashboard_provisioning.dashboard_id
-- 		LEFT OUTER JOIN dashboard_version  ON dashboard.id = dashboard_version.dashboard_id
-- 		LEFT OUTER JOIN ` + usertable + ` AS created_user ON dashboard.created_by = created_user.id
-- 		LEFT OUTER JOIN ` + usertable + ` AS updated_user ON dashboard_version.created_by = updated_user.id
-- 		WHERE dashboard.is_folder = false
-- 			AND dashboard.org_id=?$1