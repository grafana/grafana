package legacy

import (
	"context"
	"database/sql"
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

type LegacySQL struct {
	db      legacysql.LegacyDatabaseProvider
	startup time.Time
}

func NewLegacySQL(db legacysql.LegacyDatabaseProvider) *LegacySQL {
	return &LegacySQL{db: db, startup: time.Now()}
}

// NOTE: this does not support paging -- lets check if that will be a problem in cloud
func (s *LegacySQL) getDashboardStars(ctx context.Context, orgId int64, user string) ([]dashboardStars, int64, error) {
	var max sql.NullString
	sql, err := s.db(ctx)
	if err != nil {
		return nil, 0, err
	}

	req := newStarQueryReq(sql, user, orgId)

	q, err := sqltemplate.Execute(sqlDashboardStarsQuery, req)
	if err != nil {
		return nil, 0, fmt.Errorf("execute template %q: %w", sqlDashboardStarsQuery.Name(), err)
	}

	sess := sql.DB.GetSqlxSession()
	rows, err := sess.Query(ctx, q, req.GetArgs()...)
	if err != nil {
		return nil, 0, err
	}
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
		q, err = sqltemplate.Execute(sqlDashboardStarsRV, req)
		if err != nil {
			return nil, 0, fmt.Errorf("execute template %q: %w", sqlDashboardStarsRV.Name(), err)
		}
		err = sess.Get(ctx, &max, q)
		if err != nil {
			return nil, 0, fmt.Errorf("unable to get RV %w", err)
		}
		if max.Valid && max.String != "" {
			t, _ := time.Parse(time.RFC3339, max.String)
			if !t.IsZero() {
				updated = t
			}
		} else {
			updated = s.startup
		}
	}

	return stars, updated.UnixMilli(), err
}
