//go:build integration

package azure

import (
	"context"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

type heldAzureResponse struct {
	Client
	calls     atomic.Int32
	holdFirst bool
	firstDone chan struct{}
}

func (c *heldAzureResponse) EmbedTexts(ctx context.Context, texts []string, dim int) (EmbedResult, error) {
	n := c.calls.Add(1)
	result, err := c.Client.EmbedTexts(ctx, texts, dim)
	if n == 1 && c.holdFirst && err == nil {
		<-ctx.Done()
		close(c.firstDone)
		return EmbedResult{}, ctx.Err()
	}
	return result, err
}

func (c *heldAzureResponse) EmbedTextsHedge(ctx context.Context, texts []string, dim int) (EmbedResult, error) {
	c.calls.Add(1)
	return c.Client.(interface {
		EmbedTextsHedge(context.Context, []string, int) (EmbedResult, error)
	}).EmbedTextsHedge(ctx, texts, dim)
}

func TestIntegration_QueryHedge_Azure(t *testing.T) {
	endpoint := os.Getenv("AZURE_OPENAI_ENDPOINT")
	if endpoint == "" {
		t.Skip("AZURE_OPENAI_ENDPOINT not set; live query hedge unverified")
	}
	deployment := os.Getenv("AZURE_OPENAI_DEPLOYMENT")
	if deployment == "" {
		deployment = "text-embedding-3-small"
	}
	var client Client
	var err error
	if key := os.Getenv("AZURE_OPENAI_API_KEY"); key != "" {
		client, err = NewClient(endpoint, deployment, "", key)
	} else {
		credential, credentialErr := azidentity.NewDefaultAzureCredential(nil)
		require.NoError(t, credentialErr)
		client, err = NewClientWithTokenCredential(endpoint, deployment, "", credential)
	}
	require.NoError(t, err)
	ctx, cancel := context.WithTimeout(t.Context(), 90*time.Second)
	defer cancel()
	hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
	require.NoError(t, err)
	query := embedder.EmbedTextInput{Texts: []string{"Production API latency"}, Task: embedder.TaskRetrievalQuery}
	out, err := NewDenseEmbedder(client, 1024, 50, hedger).EmbedText(ctx, query)
	require.NoError(t, err)
	require.NotEmpty(t, out.Embeddings[0].Dense)

	held := &heldAzureResponse{Client: client, holdFirst: true, firstDone: make(chan struct{})}
	out, err = NewDenseEmbedder(held, 1024, 50, hedger).EmbedText(ctx, query)
	require.NoError(t, err)
	require.NotEmpty(t, out.Embeddings[0].Dense)
	require.Equal(t, int32(2), held.calls.Load())
	select {
	case <-held.firstDone:
	case <-ctx.Done():
		t.Fatal("held original did not observe cancellation")
	}

	document := &heldAzureResponse{Client: client}
	_, err = NewDenseEmbedder(document, 1024, 50, hedger).EmbedText(ctx, embedder.EmbedTextInput{Texts: []string{"Production API latency dashboard"}, Task: embedder.TaskRetrievalDocument})
	require.NoError(t, err)
	require.Equal(t, int32(1), document.calls.Load())
}
