SELECT
    p.id,
    p.org_id,
    p.uid,
    p.name,
    p.interval,
    p.created_at,
    p.updated_at,
    pi.type as item_type,
    pi.value as item_value
FROM
    {{ .Ident .PlaylistTable }} as p
    LEFT OUTER JOIN {{ .Ident .PlaylistItemTable }} as pi ON p.id = pi.playlist_id
WHERE
    p.org_id = {{ .Arg .Query.OrgID }}
ORDER BY
    p.id ASC,
    pi.{{ .Ident "order" }} ASC