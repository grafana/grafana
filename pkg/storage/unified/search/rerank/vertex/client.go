package vertex

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	discoveryengine "cloud.google.com/go/discoveryengine/apiv1"
	"cloud.google.com/go/discoveryengine/apiv1/discoveryenginepb"
	"google.golang.org/api/option"
)

// rankClient is the production Client backed by the Discovery Engine
// RankService (gRPC). Auth uses Application Default Credentials by
// default; pass option.WithCredentials(...) via opts to override.
type rankClient struct {
	client        *discoveryengine.RankClient
	rankingConfig string
}

// NewClient builds a Client against the Ranking API for the given
// project/location. Location "global" (the default) uses the base
// endpoint; "eu"/"us" multi-regions use their residency endpoints.
func NewClient(ctx context.Context, projectID, location string, opts ...option.ClientOption) (Client, error) {
	if projectID == "" {
		return nil, fmt.Errorf("vertex rerank: projectID is required")
	}
	location = strings.TrimSpace(location)
	if location == "" {
		location = "global"
	}
	endpoint := "discoveryengine.googleapis.com:443"
	if location != "global" {
		endpoint = fmt.Sprintf("%s-discoveryengine.googleapis.com:443", location)
	}
	clientOpts := append([]option.ClientOption{option.WithEndpoint(endpoint)}, opts...)

	c, err := discoveryengine.NewRankClient(ctx, clientOpts...)
	if err != nil {
		return nil, fmt.Errorf("vertex rerank: new rank client: %w", err)
	}
	return &rankClient{
		client: c,
		rankingConfig: fmt.Sprintf("projects/%s/locations/%s/rankingConfigs/default_ranking_config",
			projectID, location),
	}, nil
}

func (c *rankClient) Rank(ctx context.Context, model, query string, texts []string) ([]RecordScore, error) {
	records := make([]*discoveryenginepb.RankingRecord, len(texts))
	for i, t := range texts {
		records[i] = &discoveryenginepb.RankingRecord{
			Id:      strconv.Itoa(i),
			Content: t,
		}
	}
	resp, err := c.client.Rank(ctx, &discoveryenginepb.RankRequest{
		RankingConfig: c.rankingConfig,
		Model:         model,
		TopN:          int32(len(texts)),
		Query:         query,
		Records:       records,
		// We only need ids + scores back, not record payloads.
		IgnoreRecordDetailsInResponse: true,
	})
	if err != nil {
		return nil, fmt.Errorf("vertex rerank: rank: %w", err)
	}
	out := make([]RecordScore, 0, len(resp.GetRecords()))
	for _, r := range resp.GetRecords() {
		out = append(out, RecordScore{ID: r.GetId(), Score: float64(r.GetScore())})
	}
	return out, nil
}

// Close releases the underlying gRPC connection.
func (c *rankClient) Close() error {
	if c.client == nil {
		return nil
	}
	return c.client.Close()
}
