SELECT DISTINCT(u.uid) 
  FROM {{ .Ident .StarTable }} as s 
  JOIN {{ .Ident .UserTable }} as u ON s.user_id = u.id
 WHERE s.org_id = {{ .Arg .OrgID }}