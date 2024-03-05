package entity

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/apis/playlist/v0alpha1"
	entityStore "github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func TestResourceToEntity(t *testing.T) {
	createdAt := metav1.Now()
	createdAtStr := createdAt.UTC().Format(time.RFC3339)

	// truncate here because RFC3339 doesn't support millisecond precision
	// consider updating accessor to use RFC3339Nano to encode timestamps
	updatedAt := createdAt.Add(time.Hour).Truncate(time.Second)
	updatedAtStr := updatedAt.UTC().Format(time.RFC3339)

	Scheme := runtime.NewScheme()
	Scheme.AddKnownTypes(v0alpha1.PlaylistResourceInfo.GroupVersion(), &v0alpha1.Playlist{})
	Codecs := serializer.NewCodecFactory(Scheme)

	testCases := []struct {
		requestInfo          *request.RequestInfo
		resource             runtime.Object
		codec                runtime.Codec
		expectedKey          string
		expectedGroupVersion string
		expectedName         string
		expectedNamespace    string
		expectedTitle        string
		expectedGuid         string
		expectedVersion      string
		expectedFolder       string
		expectedCreatedAt    int64
		expectedUpdatedAt    int64
		expectedCreatedBy    string
		expectedUpdatedBy    string
		expectedSlug         string
		expectedOrigin       *entityStore.EntityOriginInfo
		expectedLabels       map[string]string
		expectedMeta         []byte
		expectedBody         []byte
	}{
		{
			requestInfo: &request.RequestInfo{
				APIGroup:   "playlist.grafana.app",
				APIVersion: "v0alpha1",
				Resource:   "playlists",
				Namespace:  "default",
				Name:       "test-name",
			},
			resource: &v0alpha1.Playlist{
				ObjectMeta: metav1.ObjectMeta{
					CreationTimestamp: createdAt,
					Labels:            map[string]string{"label1": "value1", "label2": "value2"},
					Name:              "test-name",
					ResourceVersion:   "1",
					UID:               "test-uid",
					Annotations: map[string]string{
						"grafana.app/createdBy":        "test-created-by",
						"grafana.app/updatedBy":        "test-updated-by",
						"grafana.app/updatedTimestamp": updatedAtStr,
						"grafana.app/folder":           "test-folder",
						"grafana.app/slug":             "test-slug",
					},
				},
				Spec: v0alpha1.Spec{
					Title:    "A playlist",
					Interval: "5m",
					Items: []v0alpha1.Item{
						{Type: v0alpha1.ItemTypeDashboardByTag, Value: "panel-tests"},
						{Type: v0alpha1.ItemTypeDashboardByUid, Value: "vmie2cmWz"},
					},
				},
			},
			expectedKey:          "/playlist.grafana.app/playlists/namespaces/default/test-name",
			expectedGroupVersion: "v0alpha1",
			expectedName:         "test-name",
			expectedNamespace:    "default",
			expectedTitle:        "A playlist",
			expectedGuid:         "test-uid",
			expectedVersion:      "1",
			expectedFolder:       "test-folder",
			expectedCreatedAt:    createdAt.UnixMilli(),
			expectedUpdatedAt:    updatedAt.UnixMilli(),
			expectedCreatedBy:    "test-created-by",
			expectedUpdatedBy:    "test-updated-by",
			expectedSlug:         "test-slug",
			expectedOrigin:       &entityStore.EntityOriginInfo{Source: "", Key: ""},
			expectedLabels:       map[string]string{"label1": "value1", "label2": "value2"},
			expectedMeta:         []byte(fmt.Sprintf(`{"metadata":{"name":"test-name","uid":"test-uid","resourceVersion":"1","creationTimestamp":%q,"labels":{"label1":"value1","label2":"value2"},"annotations":{"grafana.app/createdBy":"test-created-by","grafana.app/folder":"test-folder","grafana.app/slug":"test-slug","grafana.app/updatedBy":"test-updated-by","grafana.app/updatedTimestamp":%q}}}`, createdAtStr, updatedAtStr)),
			expectedBody:         []byte(fmt.Sprintf(`{"kind":"Playlist","apiVersion":"playlist.grafana.app/v0alpha1","metadata":{"name":"test-name","uid":"test-uid","resourceVersion":"1","creationTimestamp":%q,"labels":{"label1":"value1","label2":"value2"},"annotations":{"grafana.app/createdBy":"test-created-by","grafana.app/folder":"test-folder","grafana.app/slug":"test-slug","grafana.app/updatedBy":"test-updated-by","grafana.app/updatedTimestamp":%q}},"spec":{"title":"A playlist","interval":"5m","items":[{"type":"dashboard_by_tag","value":"panel-tests"},{"type":"dashboard_by_uid","value":"vmie2cmWz"}]}}`, createdAtStr, updatedAtStr)),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.resource.GetObjectKind().GroupVersionKind().Kind+" to entity conversion should succeed", func(t *testing.T) {
			entity, err := resourceToEntity(tc.resource, tc.requestInfo, Codecs.LegacyCodec(v0alpha1.PlaylistResourceInfo.GroupVersion()))
			require.NoError(t, err)
			assert.Equal(t, tc.expectedKey, entity.Key)
			assert.Equal(t, tc.expectedName, entity.Name)
			assert.Equal(t, tc.expectedNamespace, entity.Namespace)
			assert.Equal(t, tc.expectedTitle, entity.Title)
			assert.Equal(t, tc.expectedGroupVersion, entity.GroupVersion)
			assert.Equal(t, tc.expectedName, entity.Name)
			assert.Equal(t, tc.expectedGuid, entity.Guid)
			assert.Equal(t, tc.expectedFolder, entity.Folder)
			assert.Equal(t, tc.expectedCreatedAt, entity.CreatedAt)
			assert.Equal(t, tc.expectedUpdatedAt, entity.UpdatedAt)
			assert.Equal(t, tc.expectedCreatedBy, entity.CreatedBy)
			assert.Equal(t, tc.expectedUpdatedBy, entity.UpdatedBy)
			assert.Equal(t, tc.expectedSlug, entity.Slug)
			assert.Equal(t, tc.expectedOrigin, entity.Origin)
			assert.Equal(t, tc.expectedLabels, entity.Labels)
			assert.Equal(t, tc.expectedMeta, entity.Meta)
			assert.Equal(t, tc.expectedBody, entity.Body[:len(entity.Body)-1]) // remove trailing newline
		})
	}
}

func TestEntityToResource(t *testing.T) {
	createdAt := metav1.Now()
	createdAtStr := createdAt.UTC().Format(time.RFC3339)

	updatedAt := createdAt.Add(time.Hour)
	updatedAtStr := updatedAt.UTC().Format(time.RFC3339)

	Scheme := runtime.NewScheme()
	Scheme.AddKnownTypes(v0alpha1.PlaylistResourceInfo.GroupVersion(), &v0alpha1.Playlist{})
	Codecs := serializer.NewCodecFactory(Scheme)

	testCases := []struct {
		entity                    *entityStore.Entity
		codec                     runtime.Codec
		expectedApiVersion        string
		expectedCreationTimestamp metav1.Time
		expectedLabels            map[string]string
		expectedName              string
		expectedResourceVersion   string
		expectedUid               string
		expectedTitle             string
		expectedAnnotations       map[string]string
		expectedSpec              any
	}{
		{
			entity: &entityStore.Entity{
				Key:             "/playlist.grafana.app/playlists/namespaces/default/test-uid",
				GroupVersion:    "v0alpha1",
				Name:            "test-uid",
				Title:           "A playlist",
				Guid:            "test-guid",
				Folder:          "test-folder",
				CreatedBy:       "test-created-by",
				CreatedAt:       createdAt.UnixMilli(),
				UpdatedAt:       updatedAt.UnixMilli(),
				UpdatedBy:       "test-updated-by",
				Slug:            "test-slug",
				Origin:          &entityStore.EntityOriginInfo{},
				Labels:          map[string]string{"label1": "value1", "label2": "value2"},
				Meta:            []byte(fmt.Sprintf(`{"metadata":{"name":"test-name","uid":"test-uid","resourceVersion":"1","creationTimestamp":%q,"labels":{"label1":"value1","label2":"value2"},"annotations":{"grafana.app/createdBy":"test-created-by","grafana.app/folder":"test-folder","grafana.app/slug":"test-slug","grafana.app/updatedTimestamp":%q,"grafana.app/updatedBy":"test-updated-by"}}}`, createdAtStr, updatedAtStr)),
				Body:            []byte(fmt.Sprintf(`{"kind":"Playlist","apiVersion":"playlist.grafana.app/v0alpha1","metadata":{"name":"test-name","uid":"test-uid","resourceVersion":"1","creationTimestamp":%q,"labels":{"label1":"value1","label2":"value2"},"annotations":{"grafana.app/createdBy":"test-created-by","grafana.app/folder":"test-folder","grafana.app/slug":"test-slug","grafana.app/updatedBy":"test-updated-by","grafana.app/updatedTimestamp":%q}},"spec":{"title":"A playlist","interval":"5m","items":[{"type":"dashboard_by_tag","value":"panel-tests"},{"type":"dashboard_by_uid","value":"vmie2cmWz"}]}}`, createdAtStr, updatedAtStr)),
				ResourceVersion: 1,
			},
			codec:                     runtime.Codec(nil),
			expectedApiVersion:        "playlist.grafana.app/v0alpha1",
			expectedCreationTimestamp: createdAt,
			expectedLabels:            map[string]string{"label1": "value1", "label2": "value2"},
			expectedName:              "test-uid",
			expectedTitle:             "test-name",
			expectedResourceVersion:   "1",
			expectedUid:               "test-guid",
			expectedAnnotations: map[string]string{
				"grafana.app/createdBy":        "test-created-by",
				"grafana.app/folder":           "test-folder",
				"grafana.app/slug":             "test-slug",
				"grafana.app/updatedBy":        "test-updated-by",
				"grafana.app/updatedTimestamp": updatedAtStr,
			},
			expectedSpec: v0alpha1.Spec{
				Title:    "A playlist",
				Interval: "5m",
				Items: []v0alpha1.Item{
					{Type: v0alpha1.ItemTypeDashboardByTag, Value: "panel-tests"},
					{Type: v0alpha1.ItemTypeDashboardByUid, Value: "vmie2cmWz"},
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.entity.Key+" to resource conversion should succeed", func(t *testing.T) {
			var p v0alpha1.Playlist
			err := entityToResource(tc.entity, &p, Codecs.LegacyCodec(v0alpha1.PlaylistResourceInfo.GroupVersion()))
			require.NoError(t, err)
			assert.Equal(t, tc.expectedApiVersion, p.TypeMeta.APIVersion)
			assert.Equal(t, tc.expectedCreationTimestamp.Unix(), p.ObjectMeta.CreationTimestamp.Unix())
			assert.Equal(t, tc.expectedLabels, p.ObjectMeta.Labels)
			assert.Equal(t, tc.expectedName, p.ObjectMeta.Name)
			assert.Equal(t, tc.expectedResourceVersion, p.ObjectMeta.ResourceVersion)
			assert.Equal(t, tc.expectedUid, string(p.ObjectMeta.UID))
			assert.Equal(t, tc.expectedAnnotations, p.ObjectMeta.Annotations)
			assert.Equal(t, tc.expectedSpec, p.Spec)
		})
	}
}
