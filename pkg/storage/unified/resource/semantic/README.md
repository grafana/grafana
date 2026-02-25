# Semantic Search for Grafana Resources

This adds a semantic search endpoint to Grafana that allows agents and users to find resources (dashboards, folders, alerts, datasources, playlists) using natural language queries. Unlike lexical search, this finds results based on meaning — for example, querying "my pods keep dying" returns the Kubernetes Pod Health dashboard and the pod crash loop alert, even though no words overlap.

## How it works

1. Resource metadata (titles, descriptions, tags) is embedded into 768-dimensional vectors using Vertex AI's `text-embedding-005` model.
2. Vectors are stored in a pgvector-enabled PostgreSQL database.
3. At query time, the search query is embedded and compared against stored vectors using cosine similarity.

## Prerequisites

- **pgvector**: A PostgreSQL instance with the pgvector extension installed.
- **Vertex AI access**: A GCP project with the Vertex AI API enabled and Application Default Credentials configured.
- **Grafana running with unified storage**.

### 1. Start pgvector

```bash
docker run -d \
  --name pgvector \
  -e POSTGRES_USER=grafana \
  -e POSTGRES_PASSWORD=grafana \
  -e POSTGRES_DB=semantic_search \
  -p 5433:5432 \
  pgvector/pgvector:pg16
```

### 2. Configure Grafana

Add to `conf/custom.ini`:

```ini
[semantic_search]
postgres_url = postgres://grafana:grafana@localhost:5433/semantic_search?sslmode=disable
embedding_dimensions = 768
```

### 3. Authenticate with GCP

```bash
gcloud auth application-default login
```

### 4. Start Grafana with Vertex AI environment variables

```bash
GOOGLE_CLOUD_PROJECT=<your-project> \
GOOGLE_CLOUD_LOCATION=us-central1 \
GOOGLE_GENAI_USE_VERTEXAI=True \
make run
```

### 5. Index your resources

This reads all resources from Grafana via the HTTP API, embeds them with Vertex AI, and writes the vectors to pgvector:

```bash
GOOGLE_CLOUD_PROJECT=<your-project> \
GOOGLE_CLOUD_LOCATION=us-central1 \
GOOGLE_GENAI_USE_VERTEXAI=True \
go run ./pkg/storage/unified/resource/semantic/testdata/index.go
```

To populate test data first:

```bash
go run ./pkg/storage/unified/resource/semantic/testdata/seed.go
```

To clean up test data:

```bash
go run ./pkg/storage/unified/resource/semantic/testdata/seed.go --cleanup
```

## Interacting with semantic search

### HTTP API

**Endpoint**: `POST /api/semantic-search`

```bash
curl -u admin:admin http://localhost:3000/api/semantic-search \
  -X POST -H 'Content-Type: application/json' \
  -d '{"query": "why are my pods crashing", "limit": 5}'
```

**Request body**:

| Field     | Type     | Required | Description                              |
|-----------|----------|----------|------------------------------------------|
| query     | string   | yes      | Natural language search query            |
| limit     | int      | no       | Max results (default 10)                 |
| namespace | string   | no       | Namespace filter (default "default")     |
| kinds     | string[] | no       | Filter by resource type, e.g. `["dashboard.grafana.app/dashboards"]` |
| min_score | float    | no       | Minimum similarity threshold (0-1)       |

**Response**:

```json
{
  "results": [
    {
      "group": "dashboard.grafana.app",
      "resource": "dashboards",
      "name": "seed-k8s-pods",
      "title": "Kubernetes Pod Health",
      "description": "Pod status, restart counts, readiness probes...",
      "score": 0.547
    }
  ]
}
```

### MCP Server (for AI agents in Cursor, Claude Desktop, etc.)

An MCP server is included that wraps the HTTP endpoint, allowing AI agents to discover and call the search tool automatically.

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "grafana-search": {
      "command": "go",
      "args": ["run", "./pkg/storage/unified/resource/semantic/testdata/mcp.go"],
      "cwd": "/path/to/grafana"
    }
  }
}
```

After reloading Cursor, agents can call the `search_grafana` tool with a natural language query. For example, asking an agent "find me dashboards about database performance" will invoke the tool and return matching results.

## File overview

| File | Description |
|------|-------------|
| `semantic/provider.go` | `EmbeddingProvider` interface |
| `semantic/vertexai.go` | Vertex AI embedding implementation |
| `semantic/store.go` | pgvector read/write operations |
| `semantic/service.go` | Service tying provider + store together |
| `semantic/testdata/seed.go` | Seeds Grafana with diverse test resources |
| `semantic/testdata/index.go` | Indexes resources into pgvector |
| `semantic/testdata/search_test_query.go` | Runs sample queries to validate quality |
| `semantic/testdata/mcp.go` | MCP server for agent integration |
| `pkg/api/semantic_search.go` | HTTP handler |
| `pkg/api/http_server.go` | Service initialization from config |
| `pkg/api/api.go` | Route registration |
