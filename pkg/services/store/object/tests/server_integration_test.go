package object_server_tests

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"
)

func TestBasic(t *testing.T) {
	ctx := context.Background()
	testCtx := createTestContext(t)

	kind := "dashboard"
	uid := "my-test-entity"
	ctx = metadata.AppendToOutgoingContext(ctx, "authorization", fmt.Sprintf("Bearer %s", testCtx.authToken))
	readResp, err := testCtx.client.Read(ctx, &object.ReadObjectRequest{
		UID:         uid,
		Kind:        kind,
		Version:     "",
		WithBody:    false,
		WithSummary: false,
	})
	require.NoError(t, err)

	require.NotNil(t, readResp)
	require.Nil(t, readResp.Object)

	body := []byte("{\"name\":\"John\"}")
	writeReq := &object.WriteObjectRequest{
		UID:     uid,
		Kind:    kind,
		Body:    body,
		Comment: "first entity!",
	}
	writeResp, err := testCtx.client.Write(ctx, writeReq)
	require.NoError(t, err)
	require.NotNil(t, writeResp)
	require.Nil(t, writeResp.Error)
	require.Nil(t, writeResp.SummaryJson)

	require.Equal(t, body, writeResp.Object.Body)
	require.Equal(t, writeReq.Comment, writeResp.Object.Comment)
	require.Equal(t, writeReq.UID, writeResp.Object.UID)
	require.Equal(t, writeReq.Kind, writeResp.Object.Kind)

	readResp, err = testCtx.client.Read(ctx, &object.ReadObjectRequest{
		UID:  uid,
		Kind: kind,
	})
	require.NoError(t, err)

	require.NotNil(t, readResp)
	require.NotNil(t, readResp.Object)

	newBody := []byte("{\"name\":\"John\"}")
	updateResp, err := testCtx.client.Write(ctx, &object.WriteObjectRequest{
		UID:             uid,
		Kind:            kind,
		Body:            newBody,
		Comment:         "new comment",
		PreviousVersion: writeResp.Object.Version,
	})
	require.NoError(t, err)

	require.NotNil(t, updateResp)
	require.NotNil(t, updateResp.Object)
	require.Equal(t, newBody, updateResp.Object.Body)

	delResp, err := testCtx.client.Delete(ctx, &object.DeleteObjectRequest{
		UID:  uid,
		Kind: kind,
	})
	require.NoError(t, err)
	require.Equal(t, true, delResp.OK)

	readResp, err = testCtx.client.Read(ctx, &object.ReadObjectRequest{
		UID:  uid,
		Kind: kind,
	})
	require.NoError(t, err)

	require.NotNil(t, readResp)
	require.Nil(t, readResp.Object)
}
