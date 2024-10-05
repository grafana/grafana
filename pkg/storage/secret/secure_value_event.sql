INSERT INTO {{ .Ident "secure_value_history" }} (
    "namespace", "name", 
    "ts", "action", "identity", "details"
  )
  VALUES (
    {{ .Arg .Event.Namespace }}, {{ .Arg .Event.Name }},
    {{ .Arg .Event.Timestamp }}, {{ .Arg .Event.Action }}, 
    {{ .Arg .Event.Identity }}, {{ .Arg .Event.Details }}
  )
;
