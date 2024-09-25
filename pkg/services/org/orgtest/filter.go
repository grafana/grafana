package orgtest

import "github.com/grafana/grafana/pkg/services/org"

type MockSearchOrgUserFilter struct {
	MockFilterList map[string]org.FilterHandler
}

func (m *MockSearchOrgUserFilter) GetFilter(filterName string, params []string) org.Filter {
	return NewMockFilter()
}

func (m *MockSearchOrgUserFilter) GetFilterList() map[string]org.FilterHandler {
	return m.MockFilterList
}

func NewMockSearchOrgUserFilter() *MockSearchOrgUserFilter {
	return &MockSearchOrgUserFilter{
		MockFilterList: make(map[string]org.FilterHandler),
	}
}

type MockFilter struct {
	MockWhereCondition *org.WhereCondition
	MockJoinCondition  *org.JoinCondition
	MockInCondition    *org.InCondition
}

func (f *MockFilter) WhereCondition() *org.WhereCondition {
	return f.MockWhereCondition
}

func (f *MockFilter) JoinCondition() *org.JoinCondition {
	return f.MockJoinCondition
}

func (f *MockFilter) InCondition() *org.InCondition {
	return f.MockInCondition
}

func NewMockFilter() *MockFilter {
	return &MockFilter{
		MockWhereCondition: &org.WhereCondition{
			Condition: "",
			Params:    "",
		},
		MockJoinCondition: &org.JoinCondition{
			Operator: "",
			Table:    "",
			Params:   "",
		},
		MockInCondition: &org.InCondition{
			Condition: "",
			Params:    []any{},
		},
	}
}
