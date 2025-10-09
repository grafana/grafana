package legacy

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	correlationsV0 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type LegacySQL struct {
	db      legacysql.LegacyDatabaseProvider
	startup time.Time
}

func NewLegacySQL(db legacysql.LegacyDatabaseProvider) *LegacySQL {
	return &LegacySQL{db: db, startup: time.Now()}
}

// Using custom SQL so we can get the types as part of the query
func (s *LegacySQL) List(ctx context.Context, orgId int64, name string, src []string) (*correlationsV0.CorrelationList, error) {
	sql, err := s.db(ctx)
	if err != nil {
		return nil, err
	}

	req := newCorrelationsQueryReq(sql, orgId)
	req.CorrelationUID = name
	req.SourceUIDs = src

	q, err := sqltemplate.Execute(sqlQuery, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQuery.Name(), err)
	}

	sess := sql.DB.GetSqlxSession()
	rows, err := sess.Query(ctx, q, req.GetArgs()...)
	if err != nil {
		return nil, err
	}
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	rsp := &correlationsV0.CorrelationList{}
	for rows.Next() {
		row := correlationsResponse{}
		// SELECT c.uid,c.org_id,c.{{ .Ident "type" }},c.config,c.description,c.label,c.provisioned,
		// 	src.{{ .Ident "type" }} as src_type, src.uid as src_uid,
		// 	tgt.{{ .Ident "type" }} as tgt_type, tgt.uid as tgt_uid

		err := rows.Scan(&row.UID, &row.OrgID, &row.Type, &row.ConfigJSON,
			&row.Description, &row.Label, &row.provisioned,
			&row.SourceType, &row.SourceUID,
			&row.TargetType, &row.TargetUID,
		)
		if err != nil {
			return nil, err
		}

		obj := correlationsV0.Correlation{
			ObjectMeta: v1.ObjectMeta{
				Name: row.UID,
			},
			Spec: correlationsV0.CorrelationSpec{
				Description: &row.Description,
				Label:       row.Label,
				Type:        correlationsV0.CorrelationCorrelationType(row.Type),
				Datasource: correlationsV0.CorrelationDataSourceRef{
					Group: row.SourceType.String,
					Name:  row.SourceUID.String,
				},
				Target: []correlationsV0.CorrelationDataSourceRef{{
					Group: row.TargetType.String,
					Name:  row.TargetUID.String,
				}},
			},
		}

		if err = json.Unmarshal([]byte(row.ConfigJSON), &row.Config); err != nil {
			return nil, fmt.Errorf("error decoding config %w", err)
		}
		obj.Spec.Config = correlations.ToSpecConfig(row.Config)
		if row.provisioned {
			v, err := utils.MetaAccessor(&obj)
			if err != nil {
				return nil, err
			}
			v.SetManagerProperties(utils.ManagerProperties{
				Kind: utils.ManagerKindClassicFP, // nolint:staticcheck
			})
		}

		rsp.Items = append(rsp.Items, obj)
	}

	return rsp, nil
}
