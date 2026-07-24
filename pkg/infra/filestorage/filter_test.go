package filestorage

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAuth(t *testing.T) {
	var tests = []struct {
		name          string
		filter        PathFilter
		expectedDeny  []string
		expectedAllow []string
	}{
		{
			name:   "can not access anything without an allow rule (deny by default)",
			filter: NewPathFilter([]string{"/b"}, nil, nil, nil),
			expectedDeny: []string{
				"/a/b.jpg",
				"/a/",
				"/c",
				"/",
			},
			expectedAllow: []string{
				"/b/",
				"/b/a.jpg",
			},
		},
		{
			name:   "can access any path with / prefix and no denies",
			filter: NewPathFilter([]string{"/"}, nil, nil, nil),
			expectedAllow: []string{
				"/a/b/c/d/e.jpg",
			},
		},
		{
			name:   "can not access paths which are explicitly denied",
			filter: NewPathFilter([]string{"/"}, nil, []string{"/x/"}, []string{"/a/b/c/d/e.jpg"}),
			expectedDeny: []string{
				"/a/b/c/d/e.jpg",
				"/x/",
				"/x/a.jpg",
				"/x/a/b.jpg",
			},
			expectedAllow: []string{
				"/a/b/c/d/x.jpg",
				"/a/b/c/d/",
			},
		},
		{
			name:   "can not access paths with denied prefixes - parent folder",
			filter: NewPathFilter([]string{"/"}, nil, []string{"/a/b/c/"}, []string{"/a/b/c/d/e.jpg"}),
			expectedDeny: []string{
				"/a/b/c/d/e.jpg",
			},
			expectedAllow: []string{
				"/a/b/x/d/e.jpg",
			},
		},
		{
			name:   "can not access paths with denied prefixes - root folder",
			filter: NewPathFilter([]string{"/"}, nil, []string{"/"}, nil),
			expectedDeny: []string{
				"/a/b/c/d/e.jpg",
				"/",
				"/a.jpg",
			},
		},
		{
			name:   "can not access paths with denied prefixes - same folder",
			filter: NewPathFilter([]string{"/"}, nil, []string{"/a/b/c/d/e"}, nil),
			expectedDeny: []string{
				"/a/b/c/d/e.jpg",
			},
		},
		{
			name:   "can not access paths with denied prefixes - parent folder with a dot",
			filter: NewPathFilter([]string{"/"}, nil, []string{"/a/b/c/d."}, nil),
			expectedDeny: []string{
				"/a/b/c/d.e/f.jpg",
			},
			expectedAllow: []string{
				"/a/b/c/e.jpg",
			},
		},
		{
			name:   "can not access paths with denied prefixes even if path is explicitly allowed - deny takes priority",
			filter: NewPathFilter([]string{"/"}, []string{"/a/b/c/d/f.jpg"}, []string{"/a/"}, nil),
			expectedDeny: []string{
				"/a/b/c/d/f.jpg",
			},
		},
		{
			name: "multiple rules",
			filter: NewPathFilter(
				[]string{"/gitB/", "/s3/folder/", "/gitC/"},
				[]string{"/gitA/dashboard2.json"},
				[]string{"/s3/folder/nested/"},
				[]string{"/gitC/nestedC/"},
			),
			expectedAllow: []string{
				"/gitA/dashboard2.json",
				"/gitB/",
				"/gitB/nested/",
				"/gitB/nested/dashboard.json",
				"/gitB/nested2/dashboard2.json",
				"/gitC/",
				"/gitC/nestedC/dashboardC.json",
				"/s3/folder/",
				"/s3/folder/file.jpg",
				"/s3/folder/nested2/file.jpg",
			},
			expectedDeny: []string{
				"/gitA/dashboard.json",             // not explicitly allowed
				"/s3/folder/nested/dashboard.json", // denied with '/s3/folder/nested/' prefix
				"/s3/nestedC/",                     // not explicitly allowed
				"/s3/anyFile.jpg",                  // not explicitly allowed
				"/s3/",                             // not explicitly allowed
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for _, expectedAllow := range tt.expectedAllow {
				require.Truef(t, tt.filter.IsAllowed(expectedAllow), "expected access to %s", expectedAllow)
			}

			for _, expectedDeny := range tt.expectedDeny {
				require.Falsef(t, tt.filter.IsAllowed(expectedDeny), "expected no access to %s", expectedDeny)
			}
		})
	}
}
