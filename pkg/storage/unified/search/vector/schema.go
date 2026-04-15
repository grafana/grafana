package vector

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"
)

//go:embed schema.sql
var schemaDDL string

// InitSchema runs idempotent DDL against the vector database to ensure the
// resource_embeddings table and its indexes exist.
func InitSchema(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, schemaDDL)
	if err != nil {
		return fmt.Errorf("init vector schema: %w", err)
	}
	return nil
}
