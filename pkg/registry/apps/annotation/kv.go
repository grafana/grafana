package annotation

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/dgraph-io/badger/v4"
	"github.com/google/uuid"
	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
)

type kvStore struct {
	db *badger.DB
}

func NewKVStore(dbdir string) (Store, error) {
	opts := badger.DefaultOptions(dbdir)
	db, err := badger.Open(opts)
	if err != nil {
		return nil, err
	}
	return &kvStore{db: db}, nil
}

func (kv *kvStore) Close() error { return kv.db.Close() }

// TODO: namespace!!!!
func keyUUID(id string) []byte           { return []byte("a:uuid:" + id) }
func keyTime(t int64, id string) []byte  { return []byte(fmt.Sprintf("a:time:%10d:%s", t/1000, id)) }
func keyDash(d string, id string) []byte { return []byte("a:dash:" + d + ":" + id) }
func keyTag(tag, id string) []byte       { return []byte("a:tag:" + tag + ":" + id) }

func (kv *kvStore) Get(ctx context.Context, namespace, name string) (*annotationV0.Annotation, error) {
	var result *annotationV0.Annotation
	err := kv.db.View(func(txn *badger.Txn) error {
		// TODO: namespace
		a, err := kv.load(txn, name)
		if err != nil {
			return err
		}
		result = a
		return nil
	})
	return result, err
}

func (kv *kvStore) List(ctx context.Context, namespace string, opts ListOptions) (*AnnotationList, error) {
	result := []annotationV0.Annotation{}

	// 	if *tag != "" {
	// 		prefix := []byte("a:tag:" + *tag + ":")
	// 		db.View(func(txn *badger.Txn) error {
	// 			it := txn.NewIterator(badger.DefaultIteratorOptions)
	// 			for it.Seek(prefix); it.ValidForPrefix(prefix); it.Next() {
	// 				parts := bytes.Split(it.Item().Key(), []byte(":"))
	// 				id := string(parts[len(parts)-1])
	// 				a, err := loadUUID(txn, id)
	// 				if err == nil && a.TimeEnd >= from && a.Time <= to {
	// 					if *dash == "" || a.DashboardUID == *dash {
	// 						result = append(result, a)
	// 					}
	// 				}
	// 			}
	// 			it.Close()
	// 			return nil
	// 		})
	// 	} else {
	prefix := []byte("a:time:")
	fromKey := []byte(fmt.Sprintf("a:time:%020d:", opts.From))
	kv.db.View(func(txn *badger.Txn) error {
		// TODO: limit
		it := txn.NewIterator(badger.DefaultIteratorOptions)
		for it.Seek(fromKey); it.ValidForPrefix(prefix); it.Next() {
			k := it.Item().Key()
			fmt.Println("key", string(k))
			parts := bytes.Split(k, []byte(":"))
			t, _ := strconv.ParseInt(string(parts[2]), 10, 64)
			if t > opts.To {
				break
			}
			id := string(parts[3])
			a, err := kv.load(txn, id)
			if err == nil {
				result = append(result, *a)
			}
		}
		it.Close()
		return nil
	})
	return &AnnotationList{Items: result}, nil
}

func (kv *kvStore) load(txn *badger.Txn, id string) (*annotationV0.Annotation, error) {
	var a annotationV0.Annotation
	item, e := txn.Get(keyUUID(id))
	if e != nil {
		return nil, e
	}
	err := item.Value(func(v []byte) error {
		return json.Unmarshal(v, &a.Spec)
	})
	if err != nil {
		return nil, err
	}
	a.Name = id
	return &a, nil
}

func (kv *kvStore) put(k, v []byte) error {
	return kv.db.Update(func(txn *badger.Txn) error { return txn.Set(k, v) })
}

func (kv *kvStore) Create(ctx context.Context, a *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	b, err := json.Marshal(a.Spec)
	if err != nil {
		return nil, err
	}
	// TODO: name, namespace
	if a.Name == "" {
		a.Name = uuid.New().String()
	}
	fmt.Println("name", a.Name)
	if err := kv.put(keyUUID(a.Name), b); err != nil {
		return nil, err
	}
	if err := kv.put(keyTime(a.Spec.Time, a.Name), []byte{}); err != nil {
		return nil, err
	}
	if a.Spec.DashboardUID != nil {
		if err := kv.put(keyDash(*a.Spec.DashboardUID, a.Name), []byte{}); err != nil {
			return nil, err
		}
	}
	for _, t := range a.Spec.Tags {
		if err := kv.put(keyTag(t, a.Name), []byte{}); err != nil {
			return nil, err
		}
	}
	return a, nil
}

func (kv *kvStore) Update(ctx context.Context, a *annotationV0.Annotation) error {
	b, err := json.Marshal(a.Spec)
	if err != nil {
		return err
	}
	return kv.db.Update(func(txn *badger.Txn) error {
		old, err := kv.load(txn, a.Name)
		if err != nil {
			return err
		}

		slices.Sort(a.Spec.Tags)
		slices.Sort(old.Spec.Tags)

		tagsChanged := false
		if len(a.Spec.Tags) != len(old.Spec.Tags) {
			tagsChanged = true
		} else {
			for i := range a.Spec.Tags {
				if a.Spec.Tags[i] != old.Spec.Tags[i] {
					tagsChanged = true
					break
				}
			}
		}
		if tagsChanged {
			for _, t := range old.Spec.Tags {
				txn.Delete(keyTag(t, a.Name))
			}
			for _, t := range a.Spec.Tags {
				txn.Set(keyTag(t, a.Name), []byte{})
			}
		}

		return txn.Set(keyUUID(a.Name), b)
	})
}

func (kv *kvStore) Delete(ctx context.Context, namespace, name string) error {
	a, err := kv.Get(ctx, namespace, name)
	if err != nil {
		return err
	}
	return kv.db.Update(func(txn *badger.Txn) error {
		if err := txn.Delete(keyUUID(a.Name)); err != nil {
			return err
		}
		if err := txn.Delete(keyTime(a.Spec.Time, a.Name)); err != nil {
			return err
		}
		if a.Spec.DashboardUID != nil {
			if err := txn.Delete(keyDash(*a.Spec.DashboardUID, a.Name)); err != nil {
				return err
			}
		}
		for _, t := range a.Spec.Tags {
			txn.Delete(keyTag(t, a.Name))
		}
		return nil
	})
}

func (kv *kvStore) Tags(ctx context.Context, namespace string, opts TagListOptions) ([]Tag, error) {
	tagCounts := make(map[string]int64)

	prefix := []byte("a:tag:")
	err := kv.db.View(func(txn *badger.Txn) error {
		it := txn.NewIterator(badger.DefaultIteratorOptions)
		for it.Seek(prefix); it.ValidForPrefix(prefix); it.Next() {
			k := it.Item().Key()
			fmt.Println("tag key", string(k))
			parts := bytes.Split(k, []byte(":"))
			if len(parts) < 4 {
				continue
			}
			tag := string(parts[2])
			if opts.Prefix == "" || strings.HasPrefix(tag, opts.Prefix) {
				tagCounts[tag]++
			}
		}
		it.Close()
		return nil
	})
	if err != nil {
		return nil, err
	}

	tags := make([]Tag, 0, len(tagCounts))
	for name, count := range tagCounts {
		tags = append(tags, Tag{Name: name, Count: count})
	}

	// TODO: sort tags by count or name?

	if opts.Limit > 0 && len(tags) > opts.Limit {
		tags = tags[:opts.Limit]
	}

	return tags, nil
}
