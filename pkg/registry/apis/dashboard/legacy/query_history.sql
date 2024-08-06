SELECT
    {{ .Ident "dashboard.org_id" }}, {{ .Ident "dashboard.id" }},
    {{ .Ident "dashboard.uid" }}, {{ .Ident "dashboard.folder_uid" }},
    {{ .Ident "dashboard.created" }}, {{ .Ident "created_user.uid as created_by" }},
    {{ .Ident "dashboard_version.created" }}, {{ .Ident "updated_user.uid as updated_by" }},
    NULL, {{ .Ident "plugin_id" }},
    {{ .Ident "dashboard_provisioning.name as origin_name" }},
    {{ .Ident "dashboard_provisioning.external_id as origin_path" }},
    {{ .Ident "dashboard_provisioning.check_sum as origin_key" }},
    {{ .Ident "dashboard_provisioning.check_sum as origin_key" }},
    {{ .Ident "dashboard_provisioning.updated as origin_ts" }},
    {{ .Ident "dashboard_version.version" }}, 
    {{ .Ident "dashboard_version.message" }}, 
    {{ .Ident "dashboard_version.data" }}
    FROM {{ .Ident "dashboard" }}
    LEFT OUTER JOIN {{ .Ident "dashboard_provisioning" }} ON {{ .Ident "dashboard.id" }} = {{ .Ident "dashboard_provisioning.dashboard_id" }}
    LEFT OUTER JOIN {{ .Ident "user" }} AS created_user ON {{ .Ident "dashboard.created_by" }} = {{ .Ident "created_user.id" }}
    LEFT OUTER JOIN {{ .Ident "user" }} AS updated_user ON {{ .Ident "dashboard_version.created_by" }} = {{ .Ident "updated_user.id" }}
    WHERE {{ .Ident "dashboard.uid" }} = {{ .Arg .Query.UID }}
	    AND {{ .Ident "dashboard.org_id" }} = {{ .Arg .Query.OrgID }}
    {{ if .Query.Version }}
      AND {{ .Ident "dashboard_version.version" }} = {{ .Arg .Query.Version }}
    {{ else if .Query.LastID }}
      AND {{ .Ident "dashboard_version.version" }} < {{ .Arg .Query.LastID }}
    {{ end }}
    ORDER BY {{ .Ident "dashboard_version.version" }} DESC
