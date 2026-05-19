SELECT t.uid
FROM {{ .Ident .TeamTable }} as t
WHERE t.org_id = {{ .Arg .Query.OrgID }}
AND t.id = {{ .Arg .Query.ID }}
LIMIT 1;