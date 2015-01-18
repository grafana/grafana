package migrations

type migration struct {
	desc        string
	sqlite      string
	verifyTable string
}

type migrationBuilder struct {
	migration *migration
}

func (b *migrationBuilder) sqlite(sql string) *migrationBuilder {
	b.migration.sqlite = sql
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
