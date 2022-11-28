package storage

import (
	"testing"

	"github.com/stretchr/testify/require"
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
