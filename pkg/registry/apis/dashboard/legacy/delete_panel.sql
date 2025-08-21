DELETE FROM {{ .Ident .LibraryElementTable }} as p
  WHERE p.org_id = {{ .Arg .Query.OrgID }}
  AND p.uid = {{ .Arg .Query.UID }}