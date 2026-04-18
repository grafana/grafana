package resource

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	"github.com/stretchr/testify/require"
	"gocloud.dev/blob/fileblob"
	"gocloud.dev/blob/memblob"
)

func TestCDKBlobStore(t *testing.T) {
	bucket := memblob.OpenBucket(nil)
	if false {
		tmp, err := os.MkdirTemp("", "xxx-*")
		require.NoError(t, err)

		bucket, err = fileblob.OpenBucket(tmp, &fileblob.Options{
			CreateDir: true,
			Metadata:  fileblob.MetadataDontWrite, // skip
		})
		require.NoError(t, err)

		fmt.Printf("ROOT: %s\n\n", tmp)
	}
	ctx := context.Background()

	store, err := NewCDKBlobSupport(ctx, CDKBlobSupportOptions{
		Bucket: bucket,
		//RootFolder: "xyz",
	})
	require.NoError(t, err)

	t.Run("can write then read a blob", func(t *testing.T) {
		raw := []byte(`{"hello": "world"}`)
		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr", // can be anything
			Namespace: "default",
			Name:      "fdgsv37qslr0ga",
		}

		rsp, err := store.PutResourceBlob(ctx, &resourcepb.PutBlobRequest{
			Resource:    key,
			Method:      resourcepb.PutBlobRequest_GRPC,
			ContentType: "application/json",
			Value:       raw,
		})
		require.NoError(t, err)
		require.Equal(t, "49dfdd54b01cbcd2d2ab5e9e5ee6b9b9", rsp.Hash)

		found, err := store.GetResourceBlob(ctx, key, &utils.BlobInfo{
			UID:      rsp.Uid,
			Size:     rsp.Size,
			Hash:     rsp.Hash,
			MimeType: rsp.MimeType,
			Charset:  rsp.Charset,
		}, false)
		require.NoError(t, err)
		require.Equal(t, raw, found.Value)
		require.Equal(t, "application/json", found.ContentType)
	})
}
