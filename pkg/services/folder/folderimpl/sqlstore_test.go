package folderimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/folder"
	"k8s.io/apimachinery/pkg/util/rand"
)

func TestCreate(t *testing.T) {}

func TestDelete(t *testing.T) {}

func TestUpdate(t *testing.T) {}

func TestGet(t *testing.T) {}

func TestGetParent(t *testing.T) {}

func TestGetParents(t *testing.T) {}

func TestGetChildren(t *testing.T) {}

func TestGetDescendents(t *testing.T) {}

func TestIntegrationFolderParents(t *testing.T) {
	db := db.InitTestDB(t)
	store := newSQLStore(db)
	// Create some folder hierarchy
	for _, cmd := range []*folder.CreateFolderCommand{
		{OrgID: 1, UID: "a", ParentUID: folder.GeneralFolderUID, Title: "A", Description: "Test folder A"},
		{OrgID: 1, UID: "b", ParentUID: "a", Title: "B", Description: "Test folder B"},
		{OrgID: 1, UID: "c1", ParentUID: "b", Title: "C-1", Description: "Test folder C-1"},
		{OrgID: 1, UID: "c2", ParentUID: "b", Title: "C-2", Description: "Test folder C-2"},
		{OrgID: 1, UID: "d1", ParentUID: "c1", Title: "D", Description: "Test folder D"},
	} {
		f, err := store.Create(context.Background(), cmd)
		if err != nil {
			t.Fatal(err)
		}
		if f.OrgID != cmd.OrgID || f.UID != cmd.UID || f.Title != cmd.Title || f.Description != cmd.Description || f.ParentUID != cmd.ParentUID {
			t.Fatal(f, cmd)
		}
	}

	uid := "c1"
	f, err := store.Get(context.Background(), &folder.GetFolderQuery{OrgID: 1, UID: &uid})
	if err != nil {
		t.Fatal(err)
	}
	if f.UID != "c1" || f.ParentUID != "b" {
		t.Fatal(f)
	}

	parents, err := store.getParentsCTE(context.Background(), &folder.GetParentsQuery{OrgID: 1, UID: "c1"})
	if err != nil {
		t.Fatal(err)
	}
	if len(parents) != 2 || parents[0].UID != "b" || parents[1].UID != "a" {
		t.Fatal(parents[0], parents[1], err)
	}
}

func BenchmarkParentFolders(b *testing.B) {
	db := db.InitTestDB(b)
	store := newSQLStore(db)
	createFolders := func(n, m int) {
		depth := map[string]int{"": 0}
		uids := []string{""}
		for i := n; i < m; i++ {
			parent := ""
			for {
				parent = uids[rand.Intn(len(uids))]
				if depth[parent] < 7 {
					break
				}
			}
			uid := fmt.Sprintf("uid-%d", i)
			if _, err := store.Create(context.Background(), &folder.CreateFolderCommand{OrgID: 0, UID: uid, ParentUID: parent, Title: uid, Description: "test folder"}); err != nil {
				b.Fatal(err)
			}
			uids = append(uids, uid)
			depth[uid] = depth[parent] + 1
		}
	}
	benchmark := func(b *testing.B, n int, fn func(context.Context, *folder.GetParentsQuery) ([]*folder.Folder, error)) {
		for i := 0; i < b.N; i++ {
			uid := fmt.Sprintf("uid-%d", i%n)
			if _, err := fn(context.Background(), &folder.GetParentsQuery{OrgID: 0, UID: uid}); err != nil {
				b.Fatal(err)
			}
		}
	}
	createFolders(0, 100)
	b.Run("100 folders", func(b *testing.B) {
		b.Run("loop", func(b *testing.B) { benchmark(b, 100, store.getParentsMySQL) })
		b.Run("CTE", func(b *testing.B) { benchmark(b, 100, store.getParentsCTE) })
	})
	createFolders(100, 1000)
	b.Run("1K folders", func(b *testing.B) {
		b.Run("loop", func(b *testing.B) { benchmark(b, 1000, store.getParentsMySQL) })
		b.Run("CTE", func(b *testing.B) { benchmark(b, 1000, store.getParentsCTE) })
	})
	createFolders(1000, 10000)
	b.Run("10K folders", func(b *testing.B) {
		b.Run("loop", func(b *testing.B) { benchmark(b, 10000, store.getParentsMySQL) })
		b.Run("CTE", func(b *testing.B) { benchmark(b, 10000, store.getParentsCTE) })
	})
}
