SELECT
    p.id,
    p.org_id,
    p.uid,
    p.name,
    p.type,
    p.description,
    p.model,
    p.version,
    p.folder_uid,
    p.created,
    p.updated,
    created_user.uid AS created_by,
    updated_user.uid AS updated_by
FROM
    {{ .Ident .LibraryElementTable }} AS p
    LEFT OUTER JOIN {{ .Ident .UserTable }} AS created_user ON p.created_by = created_user.id
    LEFT OUTER JOIN {{ .Ident .UserTable }} AS updated_user ON p.updated_by = updated_user.id
WHERE
    p.org_id = {{ .Arg .Query.OrgID }}
ORDER BY
    p.id ASC
