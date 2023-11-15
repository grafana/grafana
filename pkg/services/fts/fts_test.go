package fts

import (
	"math/rand"
	"testing"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/infra/db"
)

const cons = "bdfghjklmnprstvz"
const vowel = "aiou"

func word() string {
	s := ""
	n := rand.Intn(5) + 1
	for i := 0; i < n; i++ {
		s = s + string(cons[rand.Intn(len(cons))])
		s = s + string(vowel[rand.Intn(len(vowel))])
	}
	s = s + string(cons[rand.Intn(len(cons))])
	return s
}

func text(length int) (txt string) {
	punkt := []string{" ", ", ", "! ", "-", ": ", "? "}
	for len(txt) < length {
		txt = txt + word() + punkt[rand.Intn(len(punkt))]
	}
	return txt
}

func TestStandaloneFTS(t *testing.T) {
	db := db.InitTestDB(t)
	fts := &sqlIndex{db: db, name: "test_fts"}
	// fts := &sqliteFTSIndex{db: db, name: "test_fts"}
	if err := fts.Init(); err != nil {
		t.Fatal(err)
	}
	docs := []Document{}
	N := 100
	for i := 0; i < N; i++ {
		uid := uuid.Must(uuid.NewRandom()).String()
		doc := Document{
			DocumentID: DocumentID{
				OrgID: int64(1),
				Kind:  "test_doc",
				UID:   uid,
			},
			Fields: []Field{
				{"title", text(16)},
				{"descrption", text(140)},
			},
		}
		docs = append(docs, doc)
	}
	// inject some predictable text to search for
	index := N / 2
	docs[index].Fields[0].Value = "'Twas brillig, and the slithy toves"
	if err := fts.Update(docs...); err != nil {
		t.Fatal(err)
	}
	results, err := fts.Search("brillig")
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 || results[0] != docs[index].DocumentID {
		t.Fatal(results)
	}
}

func TestDashboardFTS(t *testing.T) {

}
