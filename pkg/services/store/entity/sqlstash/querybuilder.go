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

type joinQuery struct {
	query string
	args  []any
}

type whereClause struct {
	query string
	args  []any
}

type selectQuery struct {
	dialect  migrator.Dialect
	fields   []string    // SELECT xyz
	from     string      // FROM object
	joins    []joinQuery // JOIN object
	offset   int64
	limit    int64
	oneExtra bool

	where []whereClause

	groupBy []string

	orderBy   []string
	direction []Direction
}

func NewSelectQuery(dialect migrator.Dialect, from string) *selectQuery {
	return &selectQuery{
		dialect: dialect,
		from:    from,
	}
}

func (q *selectQuery) From(from string) {
	q.from = from
}

func (q *selectQuery) SetLimit(limit int64) {
	q.limit = limit
}

func (q *selectQuery) SetOffset(offset int64) {
	q.offset = offset
}

func (q *selectQuery) SetOneExtra() {
	q.oneExtra = true
}

func (q *selectQuery) UnsetOneExtra() {
	q.oneExtra = false
}

func (q *selectQuery) AddFields(f ...string) {
	for _, field := range f {
		q.fields = append(q.fields, "t."+q.dialect.Quote(field))
	}
}

func (q *selectQuery) AddRawFields(f ...string) {
	q.fields = append(q.fields, f...)
}

func (q *selectQuery) AddJoin(j string, args ...any) {
	q.joins = append(q.joins, joinQuery{query: j, args: args})
}

func (q *selectQuery) AddWhere(f string, val ...any) {
	// if the field contains a question mark, we assume it's a raw where clause
	if strings.Contains(f, "?") {
		q.where = append(q.where, whereClause{f, val})
		// otherwise we assume it's a field name
	} else {
		q.where = append(q.where, whereClause{"t." + q.dialect.Quote(f) + "=?", val})
	}
}

func (q *selectQuery) AddWhereInSubquery(f string, subquery string, subqueryArgs []any) {
	q.where = append(q.where, whereClause{"t." + q.dialect.Quote(f) + " IN (" + subquery + ")", subqueryArgs})
}

func (q *selectQuery) AddWhereIn(f string, vals []any) {
	count := len(vals)
	if count > 1 {
		sb := strings.Builder{}
		sb.WriteString("t." + q.dialect.Quote(f))
		sb.WriteString(" IN (")
		for i := 0; i < count; i++ {
			if i > 0 {
				sb.WriteString(",")
			}
			sb.WriteString("?")
		}
		sb.WriteString(") ")
		q.where = append(q.where, whereClause{sb.String(), vals})
	} else if count == 1 {
		q.AddWhere(f, vals[0])
	}
}

func ToAnyList[T any](input []T) []any {
	list := make([]any, len(input))
	for i, v := range input {
		list[i] = v
	}
	return list
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

func (q *selectQuery) AddWhereJsonContainsKV(field string, key string, value string) {
	escapedKey := escapeJSONStringSQLLike(key)
	escapedValue := escapeJSONStringSQLLike(value)
	q.where = append(q.where, whereClause{
		"t." + q.dialect.Quote(field) + " LIKE ? ESCAPE ?",
		[]any{"{%\"" + escapedKey + "\":\"" + escapedValue + "\"%}", sqlLikeEscape},
	})
}

func (q *selectQuery) AddGroupBy(f string) {
	q.groupBy = append(q.groupBy, f)
}

func (q *selectQuery) AddOrderBy(field string, direction Direction) {
	q.orderBy = append(q.orderBy, field)
	q.direction = append(q.direction, direction)
}

func (q *selectQuery) ToQuery() (string, []any) {
	args := []any{}
	sb := strings.Builder{}
	sb.WriteString("SELECT ")
	sb.WriteString(strings.Join(q.fields, ","))
	sb.WriteString(" FROM ")
	sb.WriteString(q.from)
	sb.WriteString(" AS t")

	for _, j := range q.joins {
		sb.WriteString(" " + j.query)
		args = append(args, j.args...)
	}

	// Templated where string
	if len(q.where) > 0 {
		sb.WriteString(" WHERE ")
		for i, w := range q.where {
			if i > 0 {
				sb.WriteString(" AND ")
			}
			sb.WriteString(w.query)
			args = append(args, w.args...)
		}
	}

	if len(q.groupBy) > 0 {
		sb.WriteString(" GROUP BY ")
		for i, f := range q.groupBy {
			if i > 0 {
				sb.WriteString(",")
			}
			sb.WriteString("t." + q.dialect.Quote(f))
		}
	}

	if len(q.orderBy) > 0 && len(q.direction) == len(q.orderBy) {
		sb.WriteString(" ORDER BY ")
		for i, f := range q.orderBy {
			if i > 0 {
				sb.WriteString(",")
			}
			sb.WriteString("t." + q.dialect.Quote(f))
			sb.WriteString(" ")
			sb.WriteString(q.direction[i].String())
		}
	}

	limit := q.limit
	if limit > 0 {
		if q.oneExtra {
			limit = limit + 1
		}
		sb.WriteString(q.dialect.LimitOffset(limit, q.offset))
	}

	return sb.String(), args
}
