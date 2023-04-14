package filters

import (
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/services/user"
)

type ActiveLast30DaysFilter struct {
	active bool
}

func NewActiveLast30DaysFilter(params []string) (user.Filter, error) {
	active, err := strconv.ParseBool(params[0])
	if err != nil {
		return nil, err
	}
	return &ActiveLast30DaysFilter{active: active}, nil
}

func (a *ActiveLast30DaysFilter) WhereCondition() *user.WhereCondition {
	if !a.active {
		return nil
	}
	return &user.WhereCondition{
		Condition: "last_seen_at > ?",
		Params:    a.whereParams(),
	}
}

func (a *ActiveLast30DaysFilter) JoinCondition() *user.JoinCondition {
	return nil
}

func (a *ActiveLast30DaysFilter) InCondition() *user.InCondition {
	return nil
}

func (a *ActiveLast30DaysFilter) whereParams() interface{} {
	activeUserTimeLimit := time.Hour * 24 * 30
	return time.Now().Add(-activeUserTimeLimit)
}
