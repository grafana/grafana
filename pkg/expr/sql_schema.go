package expr

import (
	"context"
	"time"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	queryv0alpha1 "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/sql"
)

// GetSQLSchemas returns what the schemas are for SQL expressions for all DS queries
// in the request. It executes the queries to get the schemas.
// Intended use is for autocomplete and AI, so used during the authoring/editing experience only.
func (s *Service) GetSQLSchemas(ctx context.Context, req Request) (queryv0alpha1.SQLSchema, error) {
	// Extract DS Nodes and Execute Them
	// Building the pipeline is maybe not best, as it can have more errors.
	filtered := make([]Query, 0, len(req.Queries))
	for _, q := range req.Queries {
		if NodeTypeFromDatasourceUID(q.DataSource.UID) == TypeDatasourceNode {
			filtered = append(filtered, q)
		}
	}
	req.Queries = filtered
	pipeline, err := s.buildPipeline(ctx, &req)
	if err != nil {
		return nil, err
	}

	var schemas = make(queryv0alpha1.SQLSchema)

	for _, node := range pipeline {
		// For now, execute calls convert at the end, so we are being lazy and running the full conversion. Longer run we want to run without
		// full conversion and just get the schema. Maybe conversion should be
		dsNode := node.(*DSNode)
		// Make all input to SQL
		dsNode.isInputToSQLExpr = true

		// TODO: check where time is coming from, don't recall
		res, err := dsNode.Execute(ctx, time.Now(), mathexp.Vars{}, s)
		if err != nil {
			schemas[dsNode.RefID()] = queryv0alpha1.SchemaInfo{Error: err.Error()}
			continue
			// we want to continue and get the schemas we can
		}
		if res.Error != nil {
			schemas[dsNode.RefID()] = queryv0alpha1.SchemaInfo{Error: res.Error.Error()}
			continue
			// we want to continue and get the schemas we can
		}

		frames := res.Values.AsDataFrames(dsNode.RefID())
		if len(frames) == 0 {
			schemas[dsNode.RefID()] = queryv0alpha1.SchemaInfo{Error: "no data"}
		}
		frame := frames[0]

		schema := sql.SchemaFromFrame(frame)
		columns := make([]queryv0alpha1.BasicColumn, 0, len(schema))
		for _, col := range schema {
			fT, _ := sql.MySQLColToFieldType(col)
			columns = append(columns, queryv0alpha1.BasicColumn{
				Name:               col.Name,
				MySQLType:          col.Type.String(),
				Nullable:           col.Nullable,
				DataFrameFieldType: fT,
			})
		}

		// Cap at 3 rows.
		const maxRows = 3
		n := frame.Rows()
		if n > maxRows {
			n = maxRows
		}
		sampleRows := make([][]common.Unstructured, 0, n)
		for i := 0; i < n; i++ {
			rowCopy := frame.RowCopy(i)
			u := make([]common.Unstructured, 0, len(rowCopy))
			for _, v := range rowCopy {

			}
			sampleRows = append(sampleRows, frame.RowCopy(i))
		}

		schemas[dsNode.RefID()] = queryv0alpha1.SchemaInfo{Columns: columns, SampleRows: sampleRows}
	}

	return schemas, nil
}
