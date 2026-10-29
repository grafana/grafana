package resource

import (
	"context"
	"fmt"
	"iter"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	kvpkg "github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const terminatingSection = kvpkg.TerminatingSection

// terminatingKinds are the kinds whose terminating objects are tracked. Others skip the extra KV write.
var terminatingKinds = map[string]bool{"folder.grafana.app/folders": true}

// ObjectKey identifies one object within a kind.
type ObjectKey struct{ Namespace, Name string }

// terminatingStore keeps a hint key per object that is soft-deleted but still held by finalizers, so
// a controller can find them without listing the whole collection. It is a hint: readers must
// re-fetch the object.
type terminatingStore struct {
	kv KV
}

func newTerminatingStore(kv KV) *terminatingStore {
	return &terminatingStore{kv: kv}
}

// sync records the hint when obj is terminating and clears it otherwise.
func (s *terminatingStore) sync(ctx context.Context, key *resourcepb.ResourceKey, action DataAction, obj utils.GrafanaMetaAccessor) error {
	if !terminatingKinds[key.Group+"/"+key.Resource] {
		return nil
	}
	k := terminatingKey(key.Group, key.Resource, key.Namespace, key.Name)
	if action == DataActionDeleted || obj.GetDeletionTimestamp() == nil || len(obj.GetFinalizers()) == 0 {
		return s.kv.Delete(ctx, terminatingSection, k)
	}
	w, err := s.kv.Save(ctx, terminatingSection, k)
	if err != nil {
		return err
	}
	if _, err := w.Write([]byte("1")); err != nil {
		_ = w.Close()
		return err
	}
	return w.Close()
}

// Keys streams the namespace/name of every terminating object of the given kind.
func (s *terminatingStore) Keys(ctx context.Context, group, resource string) iter.Seq2[ObjectKey, error] {
	// '0' is the byte after '/', so the range covers exactly the "group/resource/" prefix.
	prefix := group + "/" + resource
	opts := kvpkg.ListOptions{StartKey: prefix + "/", EndKey: prefix + "0"}
	return func(yield func(ObjectKey, error) bool) {
		for k, err := range s.kv.Keys(ctx, terminatingSection, opts) {
			if err != nil {
				yield(ObjectKey{}, err)
				return
			}
			parts := strings.Split(k, "/")
			if len(parts) != 4 {
				yield(ObjectKey{}, fmt.Errorf("malformed terminating key %q", k))
				return
			}
			if !yield(ObjectKey{Namespace: parts[2], Name: parts[3]}, nil) {
				return
			}
		}
	}
}

func terminatingKey(group, resource, namespace, name string) string {
	return strings.Join([]string{group, resource, namespace, name}, "/")
}
