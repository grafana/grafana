-- Delete from org_user table first (foreign key relationship)
DELETE FROM {{ .Ident .OrgUserTable }} 
WHERE user_id = (
  SELECT id FROM {{ .Ident .UserTable }} 
  WHERE uid = {{ .Arg .Command.UID }} 
    AND org_id = {{ .Arg .OrgID }}
);

-- Delete from user table
DELETE FROM {{ .Ident .UserTable }} 
WHERE uid = {{ .Arg .Command.UID }} 
  AND org_id = {{ .Arg .OrgID }}
