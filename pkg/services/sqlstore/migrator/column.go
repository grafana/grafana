package migrator

// Notice
// code based on parts from from https://github.com/go-xorm/core/blob/3e0fa232ab5c90996406c0cd7ae86ad0e5ecf85f/column.go

type Column struct {
	Name            string
	Type            string
	Length          int
	Length2         int
	Nullable        bool
	IsPrimaryKey    bool
	IsAutoIncrement bool
	Default         string
}

func (col *Column) String(d Dialect) string {
	sql := d.QuoteStr() + col.Name + d.QuoteStr() + " "

	sql += d.SqlType(col) + " "

	if col.IsPrimaryKey {
		sql += "PRIMARY KEY "
		if col.IsAutoIncrement {
			sql += d.AutoIncrStr() + " "
		}
	}

	if d.ShowCreateNull() {
		if col.Nullable {
			sql += "NULL "
		} else {
			sql += "NOT NULL "
		}
	}

	if col.Default != "" {
		sql += "DEFAULT " + col.Default + " "
	}

	return sql
}

func (col *Column) StringNoPk(d Dialect) string {
	sql := d.QuoteStr() + col.Name + d.QuoteStr() + " "

	sql += d.SqlType(col) + " "

	if d.ShowCreateNull() {
		if col.Nullable {
			sql += "NULL "
		} else {
			sql += "NOT NULL "
		}
	}

	if col.Default != "" {
		sql += "DEFAULT " + d.Default(col) + " "
	}

	return sql
}
