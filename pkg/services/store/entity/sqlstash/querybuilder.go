package sqlstash

import "strings"

type selectQuery struct {
	fields   []string // SELECT xyz
	from     string   // FROM object
	limit    int64
	oneExtra bool

	where []string
	args  []interface{}
}

func (q *selectQuery) addWhere(f string, val interface{}) {
	q.args = append(q.args, val)
	q.where = append(q.where, f+"=?")
}

func (q *selectQuery) addWhereInSubquery(f string, subquery string, subqueryArgs []interface{}) {
	q.args = append(q.args, subqueryArgs...)
	q.where = append(q.where, f+" IN ("+subquery+")")
}

func (q *selectQuery) addWhereIn(f string, vals []string) {
	count := len(vals)
	if count > 1 {
		sb := strings.Builder{}
		sb.WriteString(f)
		sb.WriteString(" IN (")
		for i := 0; i < count; i++ {
			if i > 0 {
				sb.WriteString(",")
			}
			sb.WriteString("?")
			q.args = append(q.args, vals[i])
		}
		sb.WriteString(") ")
		q.where = append(q.where, sb.String())
	} else if count == 1 {
		q.addWhere(f, vals[0])
	}
}

func (q *selectQuery) toQuery() (string, []interface{}) {
	args := q.args
	sb := strings.Builder{}
	sb.WriteString("SELECT ")
	sb.WriteString(strings.Join(q.fields, ","))
	sb.WriteString(" FROM ")
	sb.WriteString(q.from)

	// Templated where string
	where := len(q.where)
	if where > 0 {
		sb.WriteString(" WHERE ")
		for i := 0; i < where; i++ {
			if i > 0 {
				sb.WriteString(" AND ")
			}
			sb.WriteString(q.where[i])
		}
	}

	if q.limit > 0 || q.oneExtra {
		limit := q.limit
		if limit < 1 {
			limit = 20
			q.limit = limit
		}
		if q.oneExtra {
			limit = limit + 1
		}
		sb.WriteString(" LIMIT ?")
		args = append(args, limit)
	}
	return sb.String(), args
}
