DELETE FROM {{ .Ident .AlertRuleTagTable }}
WHERE EXISTS (
  SELECT 1
  FROM {{ .Ident .AlertTable }} AS alert
  WHERE alert.org_id = {{ .Arg .OrgID }}
    AND alert.id = alert_rule_tag.alert_id
)
