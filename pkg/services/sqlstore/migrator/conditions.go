package migrator

type MigrationCondition interface {
	Sql(dialect Dialect) (string, []interface{})
}

type IfTableExistsCondition struct {
	TableName string
}

func (c *IfTableExistsCondition) Sql(dialect Dialect) (string, []interface{}) {
	return dialect.TableCheckSql(c.TableName)
}
