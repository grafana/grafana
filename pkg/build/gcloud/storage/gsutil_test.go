package storage

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"cloud.google.com/go/storage"
	"github.com/stretchr/testify/require"
	"google.golang.org/api/option"
)

func Test_asChunks(t *testing.T) {
	type args struct {
		files     []File
		chunkSize int
	}
	tcs := []struct {
		name     string
		args     args
		expected [][]File
	}{
		{
			name: "Happy path #1",
			args: args{
				files: []File{
					{FullPath: "/a"},
					{FullPath: "/b"},
					{FullPath: "/c"},
					{FullPath: "/1"},
					{FullPath: "/2"},
					{FullPath: "/3"},
				},
				chunkSize: 5,
			},
			expected: [][]File{
				{{FullPath: "/a"}, {FullPath: "/b"}, {FullPath: "/c"}, {FullPath: "/1"}, {FullPath: "/2"}},
				{{FullPath: "/3"}},
			},
		},
		{
			name: "Happy path #2",
			args: args{
				files: []File{
					{FullPath: "/a"},
					{FullPath: "/b"},
					{FullPath: "/c"},
					{FullPath: "/1"},
					{FullPath: "/2"},
					{FullPath: "/3"},
				},
				chunkSize: 2,
			},
			expected: [][]File{
				{{FullPath: "/a"}, {FullPath: "/b"}},
				{{FullPath: "/c"}, {FullPath: "/1"}},
				{{FullPath: "/2"}, {FullPath: "/3"}},
			},
		},
		{
			name: "Happy path #3",
			args: args{
				files: []File{
					{FullPath: "/a"},
					{FullPath: "/b"},
					{FullPath: "/c"},
				},
				chunkSize: 1,
			},
			expected: [][]File{
				{{FullPath: "/a"}},
				{{FullPath: "/b"}},
				{{FullPath: "/c"}},
			},
		},
		{
			name: "A chunkSize with 0 value returns the input as a single chunk",
			args: args{
				files: []File{
					{FullPath: "/a"},
					{FullPath: "/b"},
					{FullPath: "/c"},
				},
				chunkSize: 0,
			},
			expected: [][]File{
				{
					{FullPath: "/a"},
					{FullPath: "/b"},
					{FullPath: "/c"},
				},
			},
		},
		{
			name: "A chunkSize with negative value returns the input as a single chunk",
			args: args{
				files: []File{
					{FullPath: "/a"},
					{FullPath: "/b"},
					{FullPath: "/c"},
				},
				chunkSize: -1,
			},
			expected: [][]File{
				{
					{FullPath: "/a"},
					{FullPath: "/b"},
					{FullPath: "/c"},
				},
			},
		},
		{
			name: "A chunkSize greater than the size on input returns the input as a single chunk",
			args: args{
				files: []File{
					{FullPath: "/a"},
					{FullPath: "/b"},
					{FullPath: "/c"},
				},
				chunkSize: 5,
			},
			expected: [][]File{
				{
					{FullPath: "/a"},
					{FullPath: "/b"},
					{FullPath: "/c"},
				},
			},
		},
		{
			name: "A chunkSize equal the size on input returns the input as a single chunk",
			args: args{
				files: []File{
					{FullPath: "/a"},
					{FullPath: "/b"},
					{FullPath: "/c"},
				},
				chunkSize: 3,
			},
			expected: [][]File{
				{
					{FullPath: "/a"},
					{FullPath: "/b"},
					{FullPath: "/c"},
				},
			},
		},
		{
			name: "An empty input returns empty chunks",
			args: args{
				files:     []File{},
				chunkSize: 3,
			},
			expected: [][]File{},
		},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			result := asChunks(tc.args.files, tc.args.chunkSize)
			require.Equal(t, tc.expected, result)
		})
	}
}

func TestCopyLocalDir(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	testFiles := []string{"file1.txt", "file2.txt"}
	for _, testFile := range testFiles {
		path := filepath.Join(tmpDir, testFile)
		require.NoError(t, os.WriteFile(path, []byte{}, 0600))
	}

	// If an upload fails then the whole copy operation should return an error.
	t.Run("failure-should-error", func(t *testing.T) {
		t.Parallel()

		// Assemble:
		ctx := context.Background()
		client := createAnonymousClient(t, ctx)
		testBucket := client.Bucket("grafana-testing-repo")

		// Act:
		err := client.CopyLocalDir(ctx, tmpDir, testBucket, "test-path", false)

		// Assert:
		// This should fail as the client has no access to the bucket to upload to:
		require.Error(t, err)
	})
}

func TestCopyRemoteDir(t *testing.T) {
	t.Parallel()

	t.Run("failure-should-error", func(t *testing.T) {
		t.Parallel()

		// Assemble:
		ctx := context.Background()
		client := createAnonymousClient(t, ctx)
		testFromBucket := client.Bucket("grafana-testing-repo")
		testToBucket := client.Bucket("grafana-testing-repo")

		// Act:
		err := client.CopyRemoteDir(ctx, testFromBucket, "test-from", testToBucket, "test-to")

		// Assert:
		// This should fail as the client has no access to the bucket to copy from/to. Unfortunately, this does not yet
		// cover if a single file fails to get transferred.
		require.Error(t, err)
	})
}

func createAnonymousClient(t *testing.T, ctx context.Context) *Client {
	t.Helper()
	storageClient, err := storage.NewClient(ctx, option.WithoutAuthentication())
	require.NoError(t, err)
	client := &Client{
		Client: *storageClient,
	}
	require.NoError(t, err)
	return client
}
