INSERT INTO {{ .Ident .QueryHistoryStarsTable }}
 ( query_uid, user_id, org_id )
VALUES 
 ( {{ .Arg .QueryUID }}, {{ .Arg .UserID }}, {{ .Arg .OrgID }} )
