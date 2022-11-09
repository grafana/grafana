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
	IsLatin         bool
	Default         string
}

func (col *Column) String(d Dialect) string {
	return d.ColString(col)
}

func (col *Column) StringNoPk(d Dialect) string {
	return d.ColStringNoPk(col)
}
