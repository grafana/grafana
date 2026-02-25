package semantic

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	_ "github.com/lib/pq"
	pgvector "github.com/pgvector/pgvector-go"
)

// EmbeddingRecord represents a resource embedding to upsert.
type EmbeddingRecord struct {
	Namespace   string
	Group       string
	Resource    string
	Name        string
	Title       string
	Description string
	Embedding   []float32
}

// SearchResult represents a single semantic search hit.
type SearchResult struct {
	Namespace   string
	Group       string
	Resource    string
	Name        string
	Title       string
	Description string
	Score       float32 // cosine similarity (0–1, higher is more similar)
}

// Store handles reading and writing embeddings in pgvector.
type Store struct {
	db         *sql.DB
	dimensions int
}

// NewStore opens a connection to the pgvector PostgreSQL database
// and ensures the schema is initialized.
func NewStore(postgresURL string, dimensions int) (*Store, error) {
	db, err := sql.Open("postgres", postgresURL)
	if err != nil {
		return nil, fmt.Errorf("opening pgvector database: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("pinging pgvector database: %w", err)
	}

	s := &Store{db: db, dimensions: dimensions}
	if err := s.initSchema(); err != nil {
		db.Close()
		return nil, fmt.Errorf("initializing pgvector schema: %w", err)
	}

	return s, nil
}

func (s *Store) initSchema() error {
	schema := fmt.Sprintf(`
		CREATE EXTENSION IF NOT EXISTS vector;

		CREATE TABLE IF NOT EXISTS resource_embedding (
			namespace   TEXT NOT NULL,
			"group"     TEXT NOT NULL,
			resource    TEXT NOT NULL,
			name        TEXT NOT NULL,
			title       TEXT NOT NULL DEFAULT '',
			description TEXT NOT NULL DEFAULT '',
			embedding   vector(%d),
			updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
			PRIMARY KEY (namespace, "group", resource, name)
		);

		CREATE INDEX IF NOT EXISTS resource_embedding_vector_idx
			ON resource_embedding USING hnsw (embedding vector_cosine_ops);
	`, s.dimensions)

	_, err := s.db.Exec(schema)
	return err
}

// Close closes the underlying database connection.
func (s *Store) Close() error {
	return s.db.Close()
}

// UpsertEmbeddings batch-upserts embedding records.
func (s *Store) UpsertEmbeddings(ctx context.Context, records []EmbeddingRecord) error {
	if len(records) == 0 {
		return nil
	}

	const batchSize = 100
	for i := 0; i < len(records); i += batchSize {
		end := i + batchSize
		if end > len(records) {
			end = len(records)
		}
		if err := s.upsertBatch(ctx, records[i:end]); err != nil {
			return fmt.Errorf("upserting batch %d-%d: %w", i, end, err)
		}
	}
	return nil
}

func (s *Store) upsertBatch(ctx context.Context, records []EmbeddingRecord) error {
	var b strings.Builder
	b.WriteString(`
		INSERT INTO resource_embedding (namespace, "group", resource, name, title, description, embedding, updated_at)
		VALUES `)

	args := make([]any, 0, len(records)*7)
	for i, r := range records {
		if i > 0 {
			b.WriteString(", ")
		}
		base := i * 7
		fmt.Fprintf(&b, "($%d, $%d, $%d, $%d, $%d, $%d, $%d, NOW())",
			base+1, base+2, base+3, base+4, base+5, base+6, base+7)
		args = append(args, r.Namespace, r.Group, r.Resource, r.Name, r.Title, r.Description, pgvector.NewVector(r.Embedding))
	}

	b.WriteString(`
		ON CONFLICT (namespace, "group", resource, name)
		DO UPDATE SET
			title = EXCLUDED.title,
			description = EXCLUDED.description,
			embedding = EXCLUDED.embedding,
			updated_at = NOW()`)

	_, err := s.db.ExecContext(ctx, b.String(), args...)
	return err
}

// Search performs cosine similarity search and returns the top results.
func (s *Store) Search(ctx context.Context, queryVector []float32, namespace string, kinds []string, limit int, minScore float32) ([]SearchResult, error) {
	if limit <= 0 {
		limit = 10
	}

	var b strings.Builder
	args := []any{pgvector.NewVector(queryVector), namespace}

	b.WriteString(`
		SELECT namespace, "group", resource, name, title, description,
			1 - (embedding <=> $1) AS score
		FROM resource_embedding
		WHERE namespace = $2`)

	if len(kinds) > 0 {
		placeholders := make([]string, len(kinds))
		for i, kind := range kinds {
			parts := strings.SplitN(kind, "/", 2)
			if len(parts) != 2 {
				return nil, fmt.Errorf("invalid kind format %q, expected 'group/resource'", kind)
			}
			args = append(args, parts[0], parts[1])
			placeholders[i] = fmt.Sprintf(`("group" = $%d AND resource = $%d)`, len(args)-1, len(args))
		}
		b.WriteString(" AND (")
		b.WriteString(strings.Join(placeholders, " OR "))
		b.WriteString(")")
	}

	if minScore > 0 {
		args = append(args, minScore)
		fmt.Fprintf(&b, " AND 1 - (embedding <=> $1) >= $%d", len(args))
	}

	args = append(args, limit)
	fmt.Fprintf(&b, "\n\t\tORDER BY embedding <=> $1\n\t\tLIMIT $%d", len(args))

	rows, err := s.db.QueryContext(ctx, b.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("executing search query: %w", err)
	}
	defer rows.Close()

	var results []SearchResult
	for rows.Next() {
		var r SearchResult
		if err := rows.Scan(&r.Namespace, &r.Group, &r.Resource, &r.Name, &r.Title, &r.Description, &r.Score); err != nil {
			return nil, fmt.Errorf("scanning search result: %w", err)
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

// DeleteEmbedding removes an embedding by its resource key.
func (s *Store) DeleteEmbedding(ctx context.Context, namespace, group, resource, name string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM resource_embedding WHERE namespace = $1 AND "group" = $2 AND resource = $3 AND name = $4`,
		namespace, group, resource, name,
	)
	return err
}
