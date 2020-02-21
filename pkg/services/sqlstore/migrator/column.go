package migrator

// Notice
// code based on parts from from https://xorm.io/core/blob/3e0fa232ab5c90996406c0cd7ae86ad0e5ecf85f/column.go

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
	return d.ColString(col)
}

func (col *Column) StringNoPk(d Dialect) string {
	return d.ColStringNoPk(col)
}
