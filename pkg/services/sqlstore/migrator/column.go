package migrator

import (
	"errors"
	"fmt"
)

// Notice
// code based on parts from from https://github.com/go-xorm/core/blob/3e0fa232ab5c90996406c0cd7ae86ad0e5ecf85f/column.go

var ErrInvalidBoolValue = errors.New("invalid boolean default value")

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

// Validate will return an error if this Column has any validation issues.
// This currently errors if a DB_Bool type column has an invalid Default literal.
func (col *Column) Validate() error {
	if col.Type == DB_Bool {
		if _, err := ParseBoolStr(col.Default); err != nil {
			return err
		}
	}
	return nil
}

// ParseBoolStr parses the string representation of the default value in a bool column.
// This is meant to ensure that all dialects support the same literals in the same way.
func ParseBoolStr(s string) (*bool, error) {
	switch s {
	case "1", "t", "T", "true", "TRUE", "True":
		return boolPtr(true), nil
	case "0", "f", "F", "false", "FALSE", "False":
		return boolPtr(false), nil
	case "NULL", "null", "Null", "":
		return nil, nil
	default:
		return nil, fmt.Errorf("%w '%s'", ErrInvalidBoolValue, s)
	}
}

func boolPtr(b bool) *bool {
	return &b
}
