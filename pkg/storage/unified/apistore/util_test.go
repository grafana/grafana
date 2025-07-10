package apistore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestToListRequest(t *testing.T) {
	tests := []struct {
		name          string
		key           *resourcepb.ResourceKey
		opts          storage.ListOptions
		want          *resourcepb.ListRequest
		wantPredicate storage.SelectionPredicate
		wantErr       error
	}{
		{
			name: "basic list request",
			key: &resourcepb.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Namespace: "default",
			},
			opts: storage.ListOptions{},
			want: &resourcepb.ListRequest{
				VersionMatchV2: 1,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{
						Group:     "test",
						Resource:  "test",
						Namespace: "default",
					},
				},
			},
			wantPredicate: storage.SelectionPredicate{},
			wantErr:       nil,
		},
		{
			name: "with resource version",
			key: &resourcepb.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Namespace: "default",
			},
			opts: storage.ListOptions{
				ResourceVersion: "123",
			},
			want: &resourcepb.ListRequest{
				VersionMatchV2:  1,
				ResourceVersion: 123,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{
						Group:     "test",
						Resource:  "test",
						Namespace: "default",
					},
				},
			},
			wantPredicate: storage.SelectionPredicate{},
			wantErr:       nil,
		},
		{
			name: "invalid resource version",
			key: &resourcepb.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Namespace: "default",
			},
			opts: storage.ListOptions{
				ResourceVersion: "invalid",
			},
			want:          nil,
			wantPredicate: storage.SelectionPredicate{},
			wantErr:       apierrors.NewBadRequest("invalid resource version: invalid"),
		},
		{
			name: "with label selector",
			key: &resourcepb.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Namespace: "default",
			},
			opts: storage.ListOptions{
				Predicate: storage.SelectionPredicate{
					Label: labels.SelectorFromSet(labels.Set{"key": "value"}),
				},
			},
			want: &resourcepb.ListRequest{
				VersionMatchV2: 1,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{
						Group:     "test",
						Resource:  "test",
						Namespace: "default",
					},
					Labels: []*resourcepb.Requirement{
						{
							Key:      "key",
							Operator: string(selection.Equals),
							Values:   []string{"value"},
						},
					},
				},
			},
			wantPredicate: storage.SelectionPredicate{
				Label: labels.SelectorFromSet(labels.Set{"key": "value"}),
			},
			wantErr: nil,
		},
		{
			name: "with trash label",
			key: &resourcepb.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Namespace: "default",
			},
			opts: storage.ListOptions{
				Predicate: storage.SelectionPredicate{
					Label: labels.SelectorFromSet(labels.Set{utils.LabelKeyGetTrash: "true"}),
				},
			},
			want: &resourcepb.ListRequest{
				VersionMatchV2: 1,
				Source:         resourcepb.ListRequest_TRASH,
				Options: &resourcepb.ListOptions{
					Labels: nil,
					Fields: nil,
					Key: &resourcepb.ResourceKey{
						Group:     "test",
						Resource:  "test",
						Namespace: "default",
					},
				},
			},
			wantPredicate: storage.Everything,
			wantErr:       nil,
		},
		{
			name: "with history label",
			key: &resourcepb.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Namespace: "default",
			},
			opts: storage.ListOptions{
				Predicate: storage.SelectionPredicate{
					Label: labels.SelectorFromSet(labels.Set{utils.LabelKeyGetHistory: "true"}),
					Field: fields.SelectorFromSet(fields.Set{"metadata.name": "test-name"}),
				},
			},
			want: &resourcepb.ListRequest{
				VersionMatchV2: 1,
				Source:         resourcepb.ListRequest_HISTORY,
				Options: &resourcepb.ListOptions{
					Labels: nil,
					Fields: nil,
					Key: &resourcepb.ResourceKey{
						Group:     "test",
						Resource:  "test",
						Namespace: "default",
						Name:      "test-name",
					},
				},
			},
			wantPredicate: storage.Everything,
			wantErr:       nil,
		},
		{
			name: "with fullpath label",
			key: &resourcepb.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Namespace: "default",
			},
			opts: storage.ListOptions{
				Predicate: storage.SelectionPredicate{
					Label: labels.SelectorFromSet(labels.Set{utils.LabelGetFullpath: "true"}),
				},
			},
			want: &resourcepb.ListRequest{
				VersionMatchV2: 1,
				Options: &resourcepb.ListOptions{
					Labels: nil,
					Fields: nil,
					Key: &resourcepb.ResourceKey{
						Group:     "test",
						Resource:  "test",
						Namespace: "default",
					},
				},
			},
			wantPredicate: storage.Everything,
			wantErr:       nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, gotPredicate, err := toListRequest(tt.key, tt.opts)
			if tt.wantErr != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.wantErr.Error(), err.Error())
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
			assert.Equal(t, tt.wantPredicate, gotPredicate)
		})
	}
}
