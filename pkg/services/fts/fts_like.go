package fts

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/search/model"
)

// sqlIndex is a naive SQL search index based on LIKE operator on a TEXT column.
// No actual indexing happens under the hood, so it's slow, but compatible with
// most of the SQL database engines.
type sqlIndex struct {
	db   db.DB
	name string
}

func (index *sqlIndex) Init() error {
	return index.db.WithDbSession(context.TODO(), func(sess *db.Session) error {
		_, err := sess.Exec(`CREATE TABLE IF NOT EXISTS ` + index.name + ` (org_id INTEGER, kind TEXT , uid TEXT, field TEXT, content TEXT)`)
		if err != nil {
			return err
		}

		// XXX: this is a terrible hack for development
		// TODO: move this to migrations
		_, err = sess.Exec(`DELETE FROM ` + index.name)
		if err != nil {
			return err
		}

		_, err = sess.Exec(`INSERT INTO ` + index.name + ` (org_id, kind, uid, field, content)
							SELECT org_id, "dashboard", uid, 'title', title FROM dashboard`)
		if err != nil {
			return err
		}
		_, err = sess.Exec(`INSERT INTO ` + index.name + ` (org_id, kind, uid, field, content)
							SELECT org_id, "folder", uid, 'title', title FROM folder`)
		if err != nil {
			return err
		}
		return err
	})
}

func (index *sqlIndex) Update(docs ...Document) error {
	// TODO: batches
	return index.db.WithDbSession(context.TODO(), func(sess *db.Session) error {
		for _, doc := range docs {
			if _, err := sess.Exec(`DELETE FROM `+index.name+` WHERE org_id = ? AND kind = ? AND uid = ?`, doc.OrgID, doc.Kind, doc.UID); err != nil {
				return err
			}
			for _, f := range doc.Fields {
				if _, err := sess.Exec(`INSERT INTO `+index.name+` (org_id, kind, uid, field, content) VALUES (?, ?, ?, ?, ?)`, doc.OrgID, doc.Kind, doc.UID, f.Field, f.Value); err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func (index *sqlIndex) Filter(query string) model.FilterWhere {
	fmt.Println("index", query)
	// TODO
	return &sqlFilter{name: index.name, query: query}
}

type sqlFilter struct {
	name  string
	query string
}

func (filter sqlFilter) LeftJoin() string {
	fmt.Println("Filter Left Join")
	return fmt.Sprintf(`%[1]s ON %[1]s.org_id = dashboard.org_id AND %[1]s.uid = dashboard.uid`, filter.name)
}

func (filter sqlFilter) Where() (string, []any) {
	fmt.Println("Filter Where " + filter.query)
	return fmt.Sprintf(`%s.content %s ?`, filter.name, "LIKE"), []any{"%" + filter.query + "%"}
}

func (index *sqlIndex) Search(query string) ([]DocumentID, error) {
	docs := []DocumentID{}
	err := index.db.WithDbSession(context.TODO(), func(sess *db.Session) error {
		rows, err := sess.Query(`SELECT org_id, kind, uid FROM `+index.name+` WHERE content `+index.db.GetDialect().LikeStr()+` ?`, "%"+query+"%")
		if err != nil {
			return err
		}
		for _, row := range rows {
			orgID, err := strconv.ParseInt(string(row["org_id"]), 10, 64)
			if err != nil {
				return err
			}
			kind := string(row["kind"])
			uid := string(row["uid"])
			docs = append(docs, DocumentID{OrgID: orgID, Kind: kind, UID: uid})
		}
		return nil
	})
	return docs, err
}
