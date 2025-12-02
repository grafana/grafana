package annotation

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strconv"

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

func keyUUID(id string) []byte           { return []byte("a:uuid:" + id) }
func keyTime(t int64, id string) []byte  { return []byte(fmt.Sprintf("a:time:%10d:%s", t/1000, id)) }
func keyDash(d string, id string) []byte { return []byte("a:dash:" + d + ":" + id) }

// func keyTag(tag, id string) []byte       { return []byte("a:tag:" + tag + ":" + id) }
// func keyTagGlobal(tag string) []byte     { return []byte("a:tags:" + tag) }

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
	// 	for _, t := range a.Tags {
	// 		put(keyTag(t, a.UUID), []byte{})
	// 		put(keyTagGlobal(t), []byte{})
	// 	}
	// 	return nil
	return a, nil
}

func (kv *kvStore) Update(ctx context.Context, a *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	b, err := json.Marshal(a.Spec)
	if err != nil {
		return nil, err
	}
	if err := kv.put(keyUUID(a.Name), b); err != nil {
		return nil, err
	}
	return nil, nil
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
		// 	for _, t := range a.Tags {
		// 		del(keyTag(t, a.UUID))
		// 	}
		return nil
	})
}

// import (
// 	"bytes"
// 	"encoding/json"
// 	"flag"
// 	"fmt"
// 	"math/rand"
// 	"os"
// 	"strconv"
// 	"strings"
// 	"time"

// 	"github.com/dgraph-io/badger/v4"
// 	"github.com/google/uuid"
// )

// type Annotation struct {
// 	UUID         string   `json:"uuid"`
// 	DashboardUID string   `json:"dashboard_uid"`
// 	Time         int64    `json:"time"`
// 	TimeEnd      int64    `json:"time_end"`
// 	Text         string   `json:"text"`
// 	Tags         []string `json:"tags"`
// 	Metadata     string   `json:"metadata"`
// 	UpdatedAt    int64    `json:"updated_at"`
// }

// func main() {
// 	dbdir := flag.String("db", "./kvdb", "")
// 	flag.Parse()
// 	opts := badger.DefaultOptions(*dbdir)
// 	d, err := badger.Open(opts)
// 	if err != nil {
// 		panic(err)
// 	}
// 	db = d
// 	defer db.Close()

// 	if len(os.Args) < 2 {
// 		fmt.Println("cmd required")
// 		return
// 	}

// 	switch os.Args[1] {
// 	case "insert":
// 		insertCmd(os.Args[2:])
// 	case "insert-random":
// 		insertRandomCmd(os.Args[2:])
// 	case "query":
// 		queryCmd(os.Args[2:])
// 	case "list-tags":
// 		listTagsCmd()
// 	case "delete-dashboard":
// 		deleteDashboardCmd(os.Args[2:])
// 	case "delete-older":
// 		deleteOlderCmd(os.Args[2:])
// 	default:
// 		fmt.Println("unknown cmd")
// 	}
// }

// func put(k, v []byte) error {
// 	return db.Update(func(txn *badger.Txn) error { return txn.Set(k, v) })
// }

// func del(k []byte) error {
// 	return db.Update(func(txn *badger.Txn) error { return txn.Delete(k) })
// }

// func keyUUID(id string) []byte {
// 	return []byte("a:uuid:" + id)
// }

// func keyTime(t int64, id string) []byte {
// 	return []byte(fmt.Sprintf("a:time:%020d:%s", t, id))
// }

// func keyDash(d string, id string) []byte {
// 	return []byte("a:dash:" + d + ":" + id)
// }

// func keyTag(tag, id string) []byte {
// 	return []byte("a:tag:" + tag + ":" + id)
// }

// func keyTagGlobal(tag string) []byte {
// 	return []byte("a:tags:" + tag)
// }

// func insert(a Annotation) error {
// }

// func deleteUUID(id string) error {
// 	var a Annotation
// 	err := db.View(func(txn *badger.Txn) error {
// 		item, e := txn.Get(keyUUID(id))
// 		if e != nil {
// 			return e
// 		}
// 		return item.Value(func(v []byte) error {
// 			return json.Unmarshal(v, &a)
// 		})
// 	})
// 	if err != nil {
// 		return err
// 	}

// 	del(keyUUID(id))
// 	del(keyTime(a.Time, a.UUID))
// 	del(keyDash(a.DashboardUID, a.UUID))
// 	for _, t := range a.Tags {
// 		del(keyTag(t, a.UUID))
// 	}
// 	return nil
// }

// func insertCmd(args []string) {
// 	fs := flag.NewFlagSet("insert", 0)
// 	text := fs.String("text", "", "")
// 	tags := fs.String("tags", "", "")
// 	dash := fs.String("dashboard", "", "")
// 	t1 := fs.Int64("time", 0, "")
// 	t2 := fs.Int64("timeend", 0, "")
// 	fs.Parse(args)

// 	a := Annotation{
// 		UUID:         uuid.NewString(),
// 		DashboardUID: *dash,
// 		Time:         *t1,
// 		TimeEnd:      *t2,
// 		Text:         *text,
// 		Tags:         strings.Split(*tags, ","),
// 		UpdatedAt:    time.Now().UnixMilli(),
// 	}
// 	insert(a)
// 	fmt.Println(a.UUID)
// }

// func insertRandomCmd(args []string) {
// 	fs := flag.NewFlagSet("insert-random", 0)
// 	n := fs.Int("n", 1000, "")
// 	fs.Parse(args)

// 	start := time.Now()
// 	for i := 0; i < *n; i++ {
// 		id := uuid.NewString()
// 		t := time.Now().UnixMilli() - rand.Int63n(1000000000)
// 		a := Annotation{
// 			UUID:         id,
// 			DashboardUID: fmt.Sprintf("dash-%d", rand.Intn(10)),
// 			Time:         t,
// 			TimeEnd:      t + rand.Int63n(100000),
// 			Text:         "text",
// 			Tags:         []string{fmt.Sprintf("tag-%d", rand.Intn(20))},
// 			UpdatedAt:    time.Now().UnixMilli(),
// 		}
// 		insert(a)
// 	}
// 	fmt.Println("duration_ms", time.Since(start).Milliseconds())
// }

// func parseAgo(s string) int64 {
// 	if s == "" {
// 		return 0
// 	}
// 	now := time.Now().UnixMilli()

// 	last := s[len(s)-1]
// 	num := s[:len(s)-1]

// 	switch last {
// 	case 's', 'm', 'h', 'd', 'w':
// 		v, err := strconv.ParseInt(num, 10, 64)
// 		if err == nil {
// 			switch last {
// 			case 's':
// 				return now - v*1000
// 			case 'm':
// 				return now - v*60*1000
// 			case 'h':
// 				return now - v*60*60*1000
// 			case 'd':
// 				return now - v*24*60*60*1000
// 			case 'w':
// 				return now - v*7*24*60*60*1000
// 			}
// 		}
// 	}

// 	v, err := strconv.ParseInt(s, 10, 64)
// 	if err == nil {
// 		return v
// 	}

// 	return 0
// }

// func queryCmd(args []string) {
// 	fs := flag.NewFlagSet("query", 0)
// 	fromS := fs.String("from", "", "")
// 	toS := fs.String("to", "", "")
// 	dash := fs.String("dashboard", "", "")
// 	tag := fs.String("tag", "", "")
// 	fs.Parse(args)

// 	from := parseAgo(*fromS)
// 	to := parseAgo(*toS)
// 	if to == 0 {
// 		to = time.Now().UnixMilli()
// 	}

// 	start := time.Now()
// 	result := []Annotation{}

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
// 		prefix := []byte("a:time:")
// 		fromKey := []byte(fmt.Sprintf("a:time:%020d:", from))
// 		db.View(func(txn *badger.Txn) error {
// 			it := txn.NewIterator(badger.DefaultIteratorOptions)
// 			for it.Seek(fromKey); it.ValidForPrefix(prefix); it.Next() {
// 				k := it.Item().Key()
// 				parts := bytes.Split(k, []byte(":"))
// 				t, _ := strconv.ParseInt(string(parts[2]), 10, 64)
// 				if t > to {
// 					break
// 				}

// 				id := string(parts[3])
// 				a, err := loadUUID(txn, id)
// 				if err == nil && a.TimeEnd >= from {
// 					if *dash == "" || a.DashboardUID == *dash {
// 						result = append(result, a)
// 					}
// 				}
// 			}
// 			it.Close()
// 			return nil
// 		})
// 	}

// 	for _, a := range result {
// 		b, _ := json.Marshal(a)
// 		fmt.Println(string(b))
// 	}

// 	fmt.Println("duration_ms", time.Since(start).Milliseconds())
// }

// func loadUUID(txn *badger.Txn, id string) (Annotation, error) {
// 	var a Annotation
// 	item, e := txn.Get(keyUUID(id))
// 	if e != nil {
// 		return a, e
// 	}
// 	item.Value(func(v []byte) error {
// 		return json.Unmarshal(v, &a)
// 	})
// 	return a, nil
// }

// func listTagsCmd() {
// 	prefix := []byte("a:tags:")
// 	db.View(func(txn *badger.Txn) error {
// 		it := txn.NewIterator(badger.DefaultIteratorOptions)
// 		for it.Seek(prefix); it.ValidForPrefix(prefix); it.Next() {
// 			k := it.Item().Key()
// 			fmt.Println(string(k[len(prefix):]))
// 		}
// 		it.Close()
// 		return nil
// 	})
// }

// func deleteDashboardCmd(args []string) {
// 	fs := flag.NewFlagSet("delete-dashboard", 0)
// 	dash := fs.String("dashboard", "", "")
// 	fs.Parse(args)

// 	prefix := []byte("a:dash:" + *dash + ":")
// 	db.View(func(txn *badger.Txn) error {
// 		it := txn.NewIterator(badger.DefaultIteratorOptions)
// 		for it.Seek(prefix); it.ValidForPrefix(prefix); it.Next() {
// 			parts := bytes.Split(it.Item().Key(), []byte(":"))
// 			id := string(parts[len(parts)-1])
// 			deleteUUID(id)
// 		}
// 		it.Close()
// 		return nil
// 	})
// }

// func deleteOlderCmd(args []string) {
// 	fs := flag.NewFlagSet("delete-older", 0)
// 	limit := fs.Int64("ts", 0, "")
// 	fs.Parse(args)

// 	prefix := []byte("a:time:")
// 	db.View(func(txn *badger.Txn) error {
// 		it := txn.NewIterator(badger.DefaultIteratorOptions)
// 		for it.Seek(prefix); it.ValidForPrefix(prefix); it.Next() {
// 			k := it.Item().Key()
// 			parts := bytes.Split(k, []byte(":"))
// 			t, _ := strconv.ParseInt(string(parts[2]), 10, 64)
// 			if t < *limit {
// 				id := string(parts[3])
// 				deleteUUID(id)
// 			}
// 		}
// 		it.Close()
// 		return nil
// 	})
// }
