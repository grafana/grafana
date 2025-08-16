package legacy

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type dashboardStars struct {
	OrgID   int64
	UserUID string
	First   int64
	Last    int64

	Dashboards []string
}

type legacyStarSQL struct {
	db legacysql.LegacyDatabaseProvider
}

// NOTE: this does not support paging -- lets check if that will be a problem in cloud
func (s *legacyStarSQL) GetStars(ctx context.Context, orgId int64, user string) ([]dashboardStars, int64, error) {
	sql, err := s.db(ctx)
	if err != nil {
		return nil, 0, err
	}

	req := newQueryReq(sql, user, orgId)

	q, err := sqltemplate.Execute(sqlStarsQuery, req)
	if err != nil {
		return nil, 0, fmt.Errorf("execute template %q: %w", sqlStarsQuery.Name(), err)
	}

	sess := sql.DB.GetSqlxSession()
	rows, err := sess.Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	stars := []dashboardStars{}
	current := &dashboardStars{}
	var orgID int64
	var userUID string
	var dashboardUID string
	var updated time.Time

	for rows.Next() {
		err := rows.Scan(&orgID, &userUID, &dashboardUID, &updated)
		if err != nil {
			return nil, 0, err
		}

		if orgID != current.OrgID || userUID != current.UserUID {
			if current.UserUID != "" {
				stars = append(stars, *current)
			}
			current = &dashboardStars{
				OrgID:   orgID,
				UserUID: userUID,
			}
		}
		ts := updated.UnixMilli()
		if ts > current.Last {
			current.Last = ts
		}
		if ts < current.First || current.First == 0 {
			current.First = ts
		}
		current.Dashboards = append(current.Dashboards, dashboardUID)
	}

	// Add the last value
	if current.UserUID != "" {
		stars = append(stars, *current)
	}

	// Find the RV unless it is a user query
	if userUID == "" {
		req.Reset()
		q, err = sqltemplate.Execute(sqlStarsRV, req)
		if err != nil {
			return nil, 0, fmt.Errorf("execute template %q: %w", sqlStarsRV.Name(), err)
		}
		err = sess.Select(ctx, &updated, q)
	}

	return stars, updated.UnixMilli(), err
}
