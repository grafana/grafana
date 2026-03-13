SELECT
    d.id, d.org_id, d.version, d.type, d.name, d.access, d.url,
    d.user, d.database, d.basic_auth, d.basic_auth_user,
    d.json_data, d.secure_json_data, d.with_credentials,
    d.is_default, d.read_only, d.uid, d.created, d.updated
FROM {{ .Ident .DataSourceTable }} as d
WHERE d.org_id = {{ .Arg .Query.OrgID }}
ORDER BY d.type ASC, d.id ASC
