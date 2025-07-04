INSERT INTO {{ .Ident .OrgUserTable }} 
  (org_id, user_id, role, created, updated)
VALUES 
  ({{ .Arg .Command.OrgID }}, {{ .Arg .UserID }}, {{ .Arg .Command.Role }}, 
   {{ .Arg .Command.Created }}, {{ .Arg .Command.Updated }})
