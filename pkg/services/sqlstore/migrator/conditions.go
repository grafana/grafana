package migrator

type MigrationCondition interface {
	Sql(dialect Dialect) (string, []interface{})
	IsFulfilled(results []map[string][]byte) bool
}

type ExistsMigrationCondition struct{}

func (c *ExistsMigrationCondition) IsFulfilled(results []map[string][]byte) bool {
	return len(results) >= 1
}

type NotExistsMigrationCondition struct{}

func (c *NotExistsMigrationCondition) IsFulfilled(results []map[string][]byte) bool {
	return len(results) == 0
}

type IfIndexExistsCondition struct {
	ExistsMigrationCondition
	TableName string
	IndexName string
}

func (c *IfIndexExistsCondition) Sql(dialect Dialect) (string, []interface{}) {
	return dialect.IndexCheckSql(c.TableName, c.IndexName)
}

type IfIndexNotExistsCondition struct {
	NotExistsMigrationCondition
	TableName string
	IndexName string
}

func (c *IfIndexNotExistsCondition) Sql(dialect Dialect) (string, []interface{}) {
	return dialect.IndexCheckSql(c.TableName, c.IndexName)
}

type IfColumnNotExistsCondition struct {
	NotExistsMigrationCondition
	TableName  string
	ColumnName string
}

func (c *IfColumnNotExistsCondition) Sql(dialect Dialect) (string, []interface{}) {
	return dialect.ColumnCheckSql(c.TableName, c.ColumnName)
}
