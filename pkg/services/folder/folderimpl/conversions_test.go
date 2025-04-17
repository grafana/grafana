package folderimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
)

func TestFolderConversions(t *testing.T) {
	input := &unstructured.Unstructured{}
	err := input.UnmarshalJSON([]byte(`{
      "kind": "Folder",
      "apiVersion": "folder.grafana.app/v1beta1",
      "metadata": {
        "name": "be79sztagf20wd",
        "namespace": "default",
        "uid": "wfi3RARqQREzEKtUJCWurWevwbQ7i9ii0cA7JUIbMtEX",
        "resourceVersion": "1734509107000",
        "creationTimestamp": "2022-12-02T02:02:02Z",
				"generation": 4,
        "labels": {
          "grafana.app/deprecatedInternalID": "234"
        },
        "annotations": {
          "grafana.app/folder": "parent-folder-name",
          "grafana.app/updatedTimestamp": "2022-12-02T07:02:02Z",
          "grafana.app/repoName": "example-repo",
          "grafana.app/createdBy": "user:useruid",
          "grafana.app/updatedBy": "user:2"
        }
      },
      "spec": {
        "title": "test folder",
        "description": "Something set in the file"
      }
    }`))
	require.NoError(t, err)

	created, err := time.Parse(time.RFC3339, "2022-12-02T02:02:02Z")
	created = created.UTC()
	require.NoError(t, err)

	fake := usertest.NewUserServiceFake()
	fake.ExpectedListUsersByIdOrUid = []*user.User{
		{
			ID:  1,
			UID: "useruid",
		},
		{
			ID:  2,
			UID: "useruid2",
		},
	}

	fs := ProvideUnifiedStore(nil, fake)

	converted, err := fs.UnstructuredToLegacyFolder(context.Background(), input)
	require.NoError(t, err)
	require.Equal(t, 1, len(fake.ListUsersByIdOrUidCalls)) // only one call to the user service
	require.Equal(t, usertest.ListUsersByIdOrUidCall{Uids: []string{"useruid"}, Ids: []int64{2}}, fake.ListUsersByIdOrUidCalls[0])
	require.Equal(t, folder.Folder{
		ID:          234,
		OrgID:       1,
		Version:     4,
		UID:         "be79sztagf20wd",
		ParentUID:   "parent-folder-name",
		Title:       "test folder",
		Description: "Something set in the file",
		URL:         "/dashboards/f/be79sztagf20wd/test-folder",
		ManagedBy:   utils.ManagerKindRepo,
		Created:     created,
		Updated:     created.Add(time.Hour * 5),
		CreatedBy:   1,
		UpdatedBy:   2,
	}, *converted)
}

func TestFolderListConversions(t *testing.T) {
	input := &unstructured.UnstructuredList{}
	err := input.UnmarshalJSON([]byte(`{
	  "apiVersion": "folder.grafana.app/v1beta1",
	  "items": [
		{
		  "apiVersion": "folder.grafana.app/v1beta1",
		  "kind": "Folder",
		  "metadata": {
			"annotations": {
			  "grafana.app/createdBy": "access-policy:service"
			},
			"creationTimestamp": "2022-12-02T02:02:02Z",
			"generation": 1,
			"labels": {
			  "grafana.app/deprecatedInternalID": "4",
			  "grafana.app/fullpath": "somefullpath",
			  "grafana.app/fullpathUIDs": "somefullpathuids"
			},
			"name": "foldername1",
			"namespace": "default",
			"resourceVersion": "1741881243564020",
			"uid": "dd669a77-7872-4c96-8fc7-899a5d8fdb6c"
		  },
		  "spec": {
			"title": "gdev dashboards",
			"description": "description gdev"
		  }
		},
		{
		  "apiVersion": "folder.grafana.app/v1beta1",
		  "kind": "Folder",
		  "metadata": {
			"annotations": {
			  "grafana.app/createdBy": "user:uuuuuuuuuuuuuu"
			},
			"creationTimestamp": "2022-12-02T02:02:02Z",
			"generation": 1,
			"labels": {
			  "grafana.app/deprecatedInternalID": "149"
			},
			"name": "foldername2",
			"namespace": "default",
			"resourceVersion": "1742998826046994",
			"uid": "941bcef6-1579-48b0-9b25-7cc227910aae"
		  },
		  "spec": {
			"title": "yeye",
			"description": "description yeye"
		  }
		},
		{
		  "apiVersion": "folder.grafana.app/v1beta1",
		  "kind": "Folder",
		  "metadata": {
			"annotations": {
			  "grafana.app/createdBy": "user:iiiiiiiiiiiiii",
			  "grafana.app/updatedBy": "user:jjjjjjjjjjjjjj"
			},
			"creationTimestamp": "2022-12-02T02:02:02Z",
			"generation": 1,
			"labels": {
			  "grafana.app/deprecatedInternalID": "145"
			},
			"name": "foldername3",
			"namespace": "default",
			"resourceVersion": "1743003591477996",
			"uid": "96083f1d-8501-425a-bbeb-c1c4ef1e9985"
		  },
		  "spec": {
			"title": "yoyo",
			"description": "description yoyo"
		  }
		},
		{
		  "apiVersion": "folder.grafana.app/v1beta1",
		  "kind": "Folder",
		  "metadata": {
			"annotations": {
			  "grafana.app/createdBy": "user:1"
			},
			"creationTimestamp": "2022-12-02T02:02:02Z",
			"generation": 1,
			"labels": {
			  "grafana.app/deprecatedInternalID": "146"
			},
			"name": "foldername4",
			"namespace": "default",
			"resourceVersion": "1742998754624006",
			"uid": "f42e5c38-8ad3-43ee-813e-575592ac88b2"
		  },
		  "spec": {
			"title": "yaya",
			"description": "description yaya"
		  }
		},
		{
		  "apiVersion": "folder.grafana.app/v1beta1",
		  "kind": "Folder",
		  "metadata": {
			"annotations": {
			  "grafana.app/createdBy": "user:2",
			  "grafana.app/updatedBy": "user:3"
			},
			"creationTimestamp": "2022-12-02T02:02:02Z",
			"generation": 1,
			"labels": {
			  "grafana.app/deprecatedInternalID": "147"
			},
			"name": "foldername5",
			"namespace": "default",
			"resourceVersion": "1742317244002993",
			"uid": "b52ef257-2fed-4edc-a559-a1f68c46e75c"
		  },
		  "spec": {
			"title": "yiyi",
			"description": "description yiyi"
		  }
		},
		{
		  "apiVersion": "folder.grafana.app/v1beta1",
		  "kind": "Folder",
		  "metadata": {
			"annotations": {},
			"creationTimestamp": "2022-12-02T02:02:02Z",
			"generation": 1,
			"labels": {
			  "grafana.app/deprecatedInternalID": "148"
			},
			"name": "foldername6",
			"namespace": "default",
			"resourceVersion": "1742998544679983",
			"uid": "771747f4-d93c-4b4d-b5be-db287e559c64"
		  },
		  "spec": {
			"title": "yuyu",
			"description": "description yuyu"
		  }
		}
	  ],
	  "kind": "FolderList",
	  "metadata": {
		"resourceVersion": "1743003591477997"
	  }
	}`))

	require.NoError(t, err)

	created, err := time.Parse(time.RFC3339, "2022-12-02T02:02:02Z")
	created = created.UTC()
	require.NoError(t, err)

	fake := usertest.NewUserServiceFake()
	fake.ExpectedListUsersByIdOrUid = []*user.User{
		{
			ID:  1,
			UID: "aaaaaaaaaaaaaa",
		},
		{
			ID:  2,
			UID: "oooooooooooooo",
		},
		{
			ID:  3,
			UID: "eeeeeeeeeeeeee",
		},
		{
			ID:  4,
			UID: "uuuuuuuuuuuuuu",
		},
		{
			ID:  5,
			UID: "iiiiiiiiiiiiii",
		},
		{
			ID:  6,
			UID: "jjjjjjjjjjjjjj",
		},
	}

	fs := ProvideUnifiedStore(nil, fake)

	converted, err := fs.UnstructuredToLegacyFolderList(context.Background(), input)
	require.NoError(t, err)
	require.Equal(t, 1, len(fake.ListUsersByIdOrUidCalls)) // only one call to the user service
	require.Equal(t, usertest.ListUsersByIdOrUidCall{Uids: []string{"uuuuuuuuuuuuuu", "iiiiiiiiiiiiii", "jjjjjjjjjjjjjj"}, Ids: []int64{1, 2, 3}}, fake.ListUsersByIdOrUidCalls[0])
	require.Equal(t, 6, len(converted))
	require.Equal(t, []*folder.Folder{
		{
			ID:          4,
			OrgID:       1,
			Version:     1,
			UID:         "foldername1",
			ParentUID:   "",
			Title:       "gdev dashboards",
			Description: "description gdev",
			URL:         "/dashboards/f/foldername1/gdev-dashboards",
			ManagedBy:   "",
			Created:     created,
			Updated:     created,
			CreatedBy:   0, // service account
			UpdatedBy:   0, // service account,
		},
		{
			ID:          149,
			OrgID:       1,
			Version:     1,
			UID:         "foldername2",
			ParentUID:   "",
			Title:       "yeye",
			Description: "description yeye",
			URL:         "/dashboards/f/foldername2/yeye",
			ManagedBy:   "",
			Created:     created,
			Updated:     created,
			CreatedBy:   4,
			UpdatedBy:   4,
		},
		{
			ID:          145,
			OrgID:       1,
			Version:     1,
			UID:         "foldername3",
			ParentUID:   "",
			Title:       "yoyo",
			Description: "description yoyo",
			URL:         "/dashboards/f/foldername3/yoyo",
			ManagedBy:   "",
			Created:     created,
			Updated:     created,
			CreatedBy:   5,
			UpdatedBy:   6,
		},
		{
			ID:          146,
			OrgID:       1,
			Version:     1,
			UID:         "foldername4",
			ParentUID:   "",
			Title:       "yaya",
			Description: "description yaya",
			URL:         "/dashboards/f/foldername4/yaya",
			ManagedBy:   "",
			Created:     created,
			Updated:     created,
			CreatedBy:   1,
			UpdatedBy:   1,
		},
		{
			ID:          147,
			OrgID:       1,
			Version:     1,
			UID:         "foldername5",
			ParentUID:   "",
			Title:       "yiyi",
			Description: "description yiyi",
			URL:         "/dashboards/f/foldername5/yiyi",
			ManagedBy:   "",
			Created:     created,
			Updated:     created,
			CreatedBy:   2,
			UpdatedBy:   3,
		},
		{
			ID:          148,
			OrgID:       1,
			Version:     1,
			UID:         "foldername6",
			ParentUID:   "",
			Title:       "yuyu",
			Description: "description yuyu",
			URL:         "/dashboards/f/foldername6/yuyu",
			ManagedBy:   "",
			Created:     created,
			Updated:     created,
			CreatedBy:   0, // no createdby
			UpdatedBy:   0,
		},
	}, converted)
}
