package migrations

type migration struct {
	desc        string
	sqlite      string
	mysql       string
	verifyTable string
}

type columnType string

const (
	DB_TYPE_STRING columnType = "String"
)

func (m *migration) getSql(dbType string) string {
	switch dbType {
	case "mysql":
		return m.mysql
	case "sqlite3":
		return m.sqlite
	}

	panic("db type not supported")
}

type migrationBuilder struct {
	migration *migration
}

func (b *migrationBuilder) sqlite(sql string) *migrationBuilder {
	b.migration.sqlite = sql
	return b
}

func (b *migrationBuilder) mysql(sql string) *migrationBuilder {
	b.migration.mysql = sql
	return b
}

func (b *migrationBuilder) verifyTable(name string) *migrationBuilder {
	b.migration.verifyTable = name
	return b
}

func (b *migrationBuilder) add() *migrationBuilder {
	migrationList = append(migrationList, b.migration)
	return b
}

func (b *migrationBuilder) desc(desc string) *migrationBuilder {
	b.migration = &migration{desc: desc}
	return b
}
