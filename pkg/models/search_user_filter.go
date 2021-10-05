package models

type SearchUserFilter interface {
	GetFilter(filterName string, params []string) Filter
	GetFilterList() map[string]FilterHandler
}

type WhereCondition struct {
	Condition string
	Params    interface{}
}

type InCondition struct {
	Condition string
	Params    interface{}
}

type JoinCondition struct {
	Operator string
	Table    string
	Params   string
}

type FilterHandler func(params []string) (Filter, error)

type Filter interface {
	WhereCondition() *WhereCondition
	InCondition() *InCondition
	JoinCondition() *JoinCondition
}
