package apistore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestToListRequest(t *testing.T) {
	tests := []struct {
		name          string
		key           *resource.ResourceKey
		opts          storage.ListOptions
		want          *resource.ListRequest
		wantPredicate storage.SelectionPredicate
		wantErr       error
	}{
		{
			name: "basic list request",
			key: &resource.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Namespace: "default",
			},
			opts: storage.ListOptions{},
			want: &resource.ListRequest{
				VersionMatchV2: 1,
				Options: &resource.ListOptions{
					Key: &resource.ResourceKey{
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
			key: &resource.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Namespace: "default",
			},
			opts: storage.ListOptions{
				ResourceVersion: "123",
			},
			want: &resource.ListRequest{
				VersionMatchV2:  1,
				ResourceVersion: 123,
				Options: &resource.ListOptions{
					Key: &resource.ResourceKey{
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
			key: &resource.ResourceKey{
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
			key: &resource.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Namespace: "default",
			},
			opts: storage.ListOptions{
				Predicate: storage.SelectionPredicate{
					Label: labels.SelectorFromSet(labels.Set{"key": "value"}),
				},
			},
			want: &resource.ListRequest{
				VersionMatchV2: 1,
				Options: &resource.ListOptions{
					Key: &resource.ResourceKey{
						Group:     "test",
						Resource:  "test",
						Namespace: "default",
					},
					Labels: []*resource.Requirement{
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
			key: &resource.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Namespace: "default",
			},
			opts: storage.ListOptions{
				Predicate: storage.SelectionPredicate{
					Label: labels.SelectorFromSet(labels.Set{utils.LabelKeyGetTrash: "true"}),
				},
			},
			want: &resource.ListRequest{
				VersionMatchV2: 1,
				Source:         resource.ListRequest_TRASH,
				Options: &resource.ListOptions{
					Labels: nil,
					Fields: nil,
					Key: &resource.ResourceKey{
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
			key: &resource.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Namespace: "default",
			},
			opts: storage.ListOptions{
				Predicate: storage.SelectionPredicate{
					Label: labels.SelectorFromSet(labels.Set{utils.LabelKeyGetHistory: "test-name"}),
				},
			},
			want: &resource.ListRequest{
				VersionMatchV2: 1,
				Source:         resource.ListRequest_HISTORY,
				Options: &resource.ListOptions{
					Labels: nil,
					Fields: nil,
					Key: &resource.ResourceKey{
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
			key: &resource.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Namespace: "default",
			},
			opts: storage.ListOptions{
				Predicate: storage.SelectionPredicate{
					Label: labels.SelectorFromSet(labels.Set{utils.LabelGetFullpath: "true"}),
				},
			},
			want: &resource.ListRequest{
				VersionMatchV2: 1,
				Options: &resource.ListOptions{
					Labels: nil,
					Fields: nil,
					Key: &resource.ResourceKey{
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
