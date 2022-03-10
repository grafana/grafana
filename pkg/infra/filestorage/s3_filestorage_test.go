//go:build integration
// +build integration

package filestorage

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
	"gocloud.dev/blob"

	"testing"
)

func Test(t *testing.T) {
	ctx := context.Background()

	bucket, err := blob.OpenBucket(ctx, "s3://s3-dashbucket?region=eu-central-1")
	require.NoError(t, err)

	fs := NewCdkBlobStorage(log.New("testlog"), bucket, "", nil)

	resp, _ := fs.ListFiles(ctx, "/", nil, nil)
	fmt.Println(len(resp.Files))
}
