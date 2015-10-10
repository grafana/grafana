package postgres

import (
  "errors"
  m "github.com/grafana/grafana/pkg/models"
  "github.com/grafana/grafana/pkg/middleware"
  "database/sql"
  _ "github.com/lib/pq"
  "net/url"
  "github.com/grafana/grafana/pkg/api/dtos"
  //"github.com/grafana/grafana/pkg/log"
  "io/ioutil"
  "encoding/json"
  "time"
  "fmt"
  "strings"
)

const INNER_QUERY = `
WITH measurement AS (
    SELECT
      (1000.0 * EXTRACT(epoch FROM time)::FLOAT / EXTRACT(epoch FROM INTERVAL '%s')::FLOAT)::BIGINT / 1000 as interval,
      *
    FROM
      (%s) filtered
    WHERE
      $1 <= filtered.time AND filtered.time <= $2
)
SELECT
  interval,
  min(time),
  %s
FROM measurement
GROUP BY 1
ORDER BY 1, 2
`

func (p *Postgres) query(q *Query) (result *dtos.MetricQueryResultDto, err error) {
  seriesPoints := make(map[string]([][2]float64))
  queryTimeIdx := make(map[string]int)

  for _, target := range q.Targets {
    series := func(col string) string {
      return fmt.Sprintf("%s %s", target.Name(), col)
    }

    if target.FilterQuery() == "" {
      err = errors.New("no filter query")
      return
    }

    if target.Aggregation() == "" {
      err = errors.New("no agg query")
      return
    }

    query := fmt.Sprintf(INNER_QUERY, q.Interval, target.FilterQuery(), target.Aggregation())

    rows, qErr := p.db.Query(query, q.Range.From(), q.Range.To())
    if qErr != nil {
      err = fmt.Errorf("%s: %s", qErr.Error(), query)
      return
    }
    defer rows.Close()

    cols, cErr := rows.Columns()
    if cErr != nil {
      err = cErr
      return
    }

    for _, col := range cols {
      if _, ok := seriesPoints[series(col)]; ok == false {
        seriesPoints[series(col)] = make([][2]float64, 0)
      }
    }

    for rows.Next() {
      vals := make([]interface{}, len(cols))
      ptrs := make([]interface{}, len(cols))

      for i, _ := range cols {
        ptrs[i] = &vals[i]
      }

      err = rows.Scan(ptrs...)
      if err != nil {
        return
      }

      delete(seriesPoints, series("interval"))

      if _, ok := queryTimeIdx[query]; ok == false {
        tcol := -1

        for i, col := range cols {
          if _, ok := vals[i].(time.Time); ok {
            delete(seriesPoints, series(col))

            if tcol == -1 {
              tcol = i
            } else {
              err = fmt.Errorf("%s: more than one timestamp column (%s, %s)", query, cols[tcol], col)
              return
            }
          }
        }

        queryTimeIdx[query] = tcol
      }

      tcol, ok := queryTimeIdx[query]
      if ok == false {
        err = fmt.Errorf("%s: no timestamp column", query)
        return
      }

      var ts float64
      if t, ok := vals[tcol].(time.Time); ok {
        ts = float64(t.UTC().UnixNano() / 1000000)
      } else {
        err = fmt.Errorf("%s: timestamp bad value (%v)", query, t)
      }

      for i, col := range cols {
        if i == 0 {
          continue
        }

        if i == tcol {
          continue
        }

        if vals[i] == nil {
          continue
        }

        var p float64
        switch t := vals[i].(type) {
        case float64:
          p = t
        case float32:
          p = float64(t)
        case int:
          p = float64(t)
        case int64:
          p = float64(t)
        default:
          err = fmt.Errorf("%s: unhandled type %s=%#v (%T)", query, col, t, t)
          return
        }

        seriesPoints[series(col)] = append(seriesPoints[series(col)], [2]float64{p, ts})
      }
    }

    err = rows.Err()
    if err != nil {
      return
    }
  }

  result = &dtos.MetricQueryResultDto{}
  result.Data = make([]dtos.MetricQueryResultDataDto, 0)

  for series, points := range seriesPoints {
    result.Data = append(result.Data, dtos.MetricQueryResultDataDto{
      Target: series,
      DataPoints: points,
    })
  }

  return
}

func (p *Postgres) getTestMetrics(q *Query, c *middleware.Context) {
  result, err := p.query(q)
  if err != nil {
    c.JsonApiErr(500, "Query failed", err)
    return
  }

  c.JSON(200, result)
}

type Postgres struct {
  db *sql.DB
}

func getHost(source *m.DataSource) (host string, err error) {
  x, ok := source.JsonData["host"]
  if ok == false {
    err = errors.New("host unset")
    return
  }

  host, ok = x.(string)
  if ok == false {
    err = errors.New("bad host type")
    return
  }

  return
}

func getSSL(source *m.DataSource) (ssl string, err error) {
  x, ok := source.JsonData["ssl"]
  if ok == false {
    err = errors.New("ssl unset")
    return
  }

  enabled, ok := x.(bool)
  if ok == false {
    err = errors.New("bad ssl type")
    return
  }

  if enabled {
    ssl = "verify-full"
  } else {
    ssl = "disable"
  }

  return
}

func getURL(source *m.DataSource) (u *url.URL, err error) {
  host, err := getHost(source)
  if err != nil {
    return
  }

  ssl, err := getSSL(source)
  if err != nil {
    return
  }

  database := source.Database
  user := source.User
  password := source.Password

  query := url.Values{}
  query.Set("sslmode", ssl)

  u = &url.URL{
    Scheme: "postgres",
    User: url.UserPassword(user, password),
    Host: host,
    Path: database,
    RawQuery: query.Encode(),
  }

  return
}

func NewPostgres(source *m.DataSource) (pg *Postgres, err error) {
  url, err := getURL(source)
  if err != nil {
    return
  }

  db, err := sql.Open("postgres", url.String())
  if err != nil {
    return
  }

  pg = &Postgres{db: db}

  return
}

func (p *Postgres) Close() error {
  return p.db.Close()
}

type QueryRange struct {
  RawFrom int64 `json:"from"`
  RawTo int64 `json:"to"`
}

func (r *QueryRange) From() time.Time {
  return time.Unix(0, r.RawFrom * 1000000)
}

func (r *QueryRange) To() time.Time {
  return time.Unix(0, r.RawTo * 1000000)
}

type QueryTarget struct {
  RawFilterQuery *string `json:"filterQuery"`
  RawAggregation *string `json:"aggregation"`
  Alias *string `json:"alias"`
  RefId *string `json:"refId"`
}

func (t *QueryTarget) Name() string {
  if t.Alias != nil && *t.Alias != "" {
    return *t.Alias
  }

  if t.FilterQuery() != "" {
    return fmt.Sprintf("[%s]", t.FilterQuery())
  }

  return ""
}

func (t *QueryTarget) FilterQuery() string {
  if t.RawFilterQuery == nil {
    return ""
  }

  return stripQuery(*t.RawFilterQuery)
}

func (t *QueryTarget) Aggregation() string {
  if t.RawAggregation == nil {
    return ""
  }

  return stripQuery(*t.RawAggregation)
}

func stripQuery(s string) string {
  s = strings.TrimSpace(s)
  s = strings.Trim(s, ";")
  return s
}

type Query struct {
  MaxDataPoints int64 `json:"maxDataPoints"`
  Interval string `json:"interval"`
  Range *QueryRange `json:"range"`
  Targets []QueryTarget `json:"targets"`
}

func getQuery(c *middleware.Context) (q *Query, err error) {
  body, err := ioutil.ReadAll(c.Req.Request.Body)
  if err != nil {
    return
  }

  qp := Query{}
  err = json.Unmarshal(body, &qp)
  if err != nil {
    return
  }

  q = &qp
  return
}

func (p *Postgres) HandleRequest(c *middleware.Context) {
  if p == nil {
    c.JsonApiErr(500, "Postgres not initialized", errors.New("Postgres not initialized"))
    return
  }

  q, err := getQuery(c)
  if err != nil {
    c.JsonApiErr(500, "Could not get query", err)
    return
  }

  p.getTestMetrics(q, c)
}
