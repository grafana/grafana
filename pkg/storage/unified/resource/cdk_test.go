package resource

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	"gocloud.dev/blob/fileblob"
	"gocloud.dev/blob/memblob"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestCDKBlobStore(t *testing.T) {
	bucket := memblob.OpenBucket(nil)
	if true {
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

	store, err := NewCDKBlobStore(ctx, CDKOptions{
		Bucket: bucket,
		//RootFolder: "xyz",
	})
	require.NoError(t, err)

	t.Run("can write then read a blob", func(t *testing.T) {
		raw := testdata(t, "01_create_playlist.json")
		key := &ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr", // can be anything
			Namespace: "default",
			Name:      "fdgsv37qslr0ga",
		}

		rsp, err := store.PutBlob(ctx, &PutBlobRequest{
			Resource:    key,
			Method:      PutBlobRequest_GRPC,
			ContentType: "application/json",
			Value:       raw,
		})
		require.NoError(t, err)
		require.Equal(t, "4933beea0c6d6dfd73150451098c70f0", rsp.Hash)

		found, err := store.GetBlob(ctx, key, &utils.BlobInfo{
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
