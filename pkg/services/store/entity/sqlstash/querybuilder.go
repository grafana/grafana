package sqlstash

import (
	"encoding/json"
	"strings"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

type Direction int

const (
	Ascending Direction = iota
	Descending
)

func (d Direction) String() string {
	if d == Descending {
		return "DESC"
	}
	return "ASC"
}

type selectQuery struct {
	dialect  migrator.Dialect
	fields   []string // SELECT xyz
	from     string   // FROM object
	offset   int64
	limit    int64
	oneExtra bool

	where []string
	args  []any

	orderBy   []string
	direction []Direction
}

func (q *selectQuery) addWhere(f string, val ...any) {
	q.args = append(q.args, val...)
	// if the field contains a question mark, we assume it's a raw where clause
	if strings.Contains(f, "?") {
		q.where = append(q.where, f)
		// otherwise we assume it's a field name
	} else {
		q.where = append(q.where, q.dialect.Quote(f)+"=?")
	}
}

func (q *selectQuery) addWhereInSubquery(f string, subquery string, subqueryArgs []any) {
	q.args = append(q.args, subqueryArgs...)
	q.where = append(q.where, q.dialect.Quote(f)+" IN ("+subquery+")")
}

func (q *selectQuery) addWhereIn(f string, vals []string) {
	count := len(vals)
	if count > 1 {
		sb := strings.Builder{}
		sb.WriteString(q.dialect.Quote(f))
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

const sqlLikeEscape = "#"

var sqlLikeEscapeReplacer = strings.NewReplacer(
	sqlLikeEscape, sqlLikeEscape+sqlLikeEscape,
	"%", sqlLikeEscape+"%",
	"_", sqlLikeEscape+"_",
)

func escapeJSONStringSQLLike(s string) string {
	b, _ := json.Marshal(s)
	return sqlLikeEscapeReplacer.Replace(string(b))
}

func (q *selectQuery) addWhereJsonContainsKV(field string, key string, value string) {
	escapedKey := escapeJSONStringSQLLike(key)
	escapedValue := escapeJSONStringSQLLike(value)
	q.where = append(q.where, q.dialect.Quote(field)+" LIKE ? ESCAPE ?")
	q.args = append(q.args, "{%"+escapedKey+":"+escapedValue+"%}", sqlLikeEscape)
}

func (q *selectQuery) addOrderBy(field string, direction Direction) {
	q.orderBy = append(q.orderBy, field)
	q.direction = append(q.direction, direction)
}

func (q *selectQuery) toQuery() (string, []any) {
	args := q.args
	sb := strings.Builder{}
	sb.WriteString("SELECT ")
	quotedFields := make([]string, len(q.fields))
	for i, f := range q.fields {
		quotedFields[i] = q.dialect.Quote(f)
	}
	sb.WriteString(strings.Join(quotedFields, ","))
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

	if len(q.orderBy) > 0 && len(q.direction) == len(q.orderBy) {
		sb.WriteString(" ORDER BY ")
		for i, f := range q.orderBy {
			if i > 0 {
				sb.WriteString(",")
			}
			sb.WriteString(q.dialect.Quote(f))
			sb.WriteString(" ")
			sb.WriteString(q.direction[i].String())
		}
	}

	limit := q.limit
	if limit < 1 {
		limit = 20
		q.limit = limit
	}
	if q.oneExtra {
		limit = limit + 1
	}
	sb.WriteString(q.dialect.LimitOffset(limit, q.offset))

	return sb.String(), args
}
