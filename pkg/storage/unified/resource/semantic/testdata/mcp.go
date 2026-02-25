// Command mcp runs an MCP (Model Context Protocol) server that exposes
// Grafana semantic search as a tool for AI agents (Cursor, Claude Desktop, etc).
//
// Usage:
//
//	go run ./pkg/storage/unified/resource/semantic/testdata/mcp.go
//
// Configure in .cursor/mcp.json:
//
//	{
//	  "mcpServers": {
//	    "grafana-search": {
//	      "command": "go",
//	      "args": ["run", "./pkg/storage/unified/resource/semantic/testdata/mcp.go"]
//	    }
//	  }
//	}
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

var (
	grafanaURL = flag.String("grafana-url", "http://localhost:3000", "Grafana base URL")
	user       = flag.String("user", "admin", "Grafana username")
	pass       = flag.String("pass", "admin", "Grafana password")
)

func main() {
	flag.Parse()

	s := server.NewMCPServer(
		"Grafana Semantic Search",
		"1.0.0",
		server.WithToolCapabilities(false),
	)

	tool := mcp.NewTool("search_grafana",
		mcp.WithDescription(
			"Search Grafana resources (dashboards, folders, alerts, datasources, playlists) "+
				"using natural language. Returns semantically similar results even when the query "+
				"doesn't share exact words with the resource titles or descriptions.",
		),
		mcp.WithString("query",
			mcp.Required(),
			mcp.Description("Natural language search query, e.g. 'why are my pods crashing' or 'database performance issues'"),
		),
		mcp.WithNumber("limit",
			mcp.Description("Maximum number of results to return (default 10)"),
		),
	)

	s.AddTool(tool, searchHandler)

	if err := server.ServeStdio(s); err != nil {
		fmt.Printf("Server error: %v\n", err)
	}
}

func searchHandler(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	query, err := request.RequireString("query")
	if err != nil {
		return mcp.NewToolResultError("query parameter is required"), nil
	}

	limit := 10
	if l, err := request.RequireFloat("limit"); err == nil {
		limit = int(l)
	}

	reqBody := map[string]any{
		"query": query,
		"limit": limit,
	}
	bodyBytes, _ := json.Marshal(reqBody)

	req, _ := http.NewRequestWithContext(ctx, "POST", *grafanaURL+"/api/semantic-search", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(*user, *pass)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to call Grafana: %v", err)), nil
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return mcp.NewToolResultError(fmt.Sprintf("Grafana returned %d: %s", resp.StatusCode, string(respBody))), nil
	}

	var searchResp struct {
		Results []struct {
			Group       string  `json:"group"`
			Resource    string  `json:"resource"`
			Name        string  `json:"name"`
			Title       string  `json:"title"`
			Description string  `json:"description"`
			Score       float32 `json:"score"`
		} `json:"results"`
	}
	if err := json.Unmarshal(respBody, &searchResp); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to parse response: %v", err)), nil
	}

	var output bytes.Buffer
	for i, r := range searchResp.Results {
		fmt.Fprintf(&output, "%d. [%.2f] %s\n", i+1, r.Score, r.Title)
		fmt.Fprintf(&output, "   Type: %s/%s | Name: %s\n", r.Group, r.Resource, r.Name)
		if r.Description != "" {
			fmt.Fprintf(&output, "   %s\n", r.Description)
		}
		output.WriteString("\n")
	}

	if len(searchResp.Results) == 0 {
		return mcp.NewToolResultText("No results found."), nil
	}

	return mcp.NewToolResultText(output.String()), nil
}
