package accesscontrol

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/user"
)

type testData struct {
	uid       string
	folderUid string
}

func (d testData) Scopes() []string {
	return []string{
		"dashboards:uid:" + d.uid,
		"folders:uid:" + d.folderUid,
	}
}

func generateTestData() []testData {
	var data []testData
	for i := 1; i < 100; i++ {
		data = append(data, testData{
			uid:       strconv.Itoa(i),
			folderUid: strconv.Itoa(i + 100),
		})
	}
	return data
}

func Test_Checker(t *testing.T) {
	data := generateTestData()
	type testCase struct {
		desc        string
		user        *user.SignedInUser
		expectedLen int
	}
	tests := []testCase{
		{
			desc: "should pass for every entity with dashboard wildcard scope",
			user: &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: {"dashboards:read": {"dashboards:*"}}},
			},
			expectedLen: len(data),
		},
		{
			desc: "should pass for every entity with folder wildcard scope",
			user: &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: {"dashboards:read": {"folders:*"}}},
			},
			expectedLen: len(data),
		},
		{
			desc: "should only pass for for 3 scopes",
			user: &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: {"dashboards:read": {"dashboards:uid:4", "dashboards:uid:50", "dashboards:uid:99"}}},
			},
			expectedLen: 3,
		},
		{
			desc: "should only pass 4 with secondary supported scope",
			user: &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: {"dashboards:read": {"folders:uid:104", "folders:uid:150", "folders:uid:154", "folders:uid:199"}}},
			},
			expectedLen: 4,
		},
		{
			desc: "should only pass 4 with some dashboard and some folder scopes",
			user: &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: {"dashboards:read": {"dashboards:uid:1", "dashboards:uid:2", "folders:uid:154", "folders:uid:199"}}},
			},
			expectedLen: 4,
		},
		{
			desc: "should only pass 2 with overlapping dashboard and folder scopes",
			user: &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: {"dashboards:read": {"dashboards:uid:101", "dashboards:uid:2", "folders:uid:101", "folders:uid:102"}}},
			},
			expectedLen: 2,
		},
		{
			desc: "should pass none for missing action",
			user: &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: {}},
			},
			expectedLen: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			check := Checker(tt.user, "dashboards:read")
			numPasses := 0
			for _, d := range data {
				if ok := check(d.Scopes()...); ok {
					numPasses++
				}
			}
			assert.Equal(t, tt.expectedLen, numPasses)
		})
	}
}
