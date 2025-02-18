SELECT t.id
FROM {{ .Ident .TeamTable }} as t
WHERE t.org_id = {{ .Arg .Query.OrgID }}
AND t.uid = {{ .Arg .Query.UID }}
LIMIT 1;
