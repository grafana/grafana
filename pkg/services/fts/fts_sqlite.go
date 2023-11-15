package fts

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/search/model"
)

// sqliteFTS is an FTS index based on a virtual table using FTS4 plugin for SQLite.
type sqliteFTS struct {
	db   db.DB
	name string
}

func (index *sqliteFTS) Init() error {
	return index.db.WithDbSession(context.TODO(), func(sess *db.Session) error {
		_, err := sess.Exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ` + index.name + ` USING FTS4 (org_id INTEGER, kind TEXT, uid TEXT, field TEXT, content TEXT)`)
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

func (index *sqliteFTS) Update(docs ...Document) error {
	// TODO: batches
	return index.db.WithDbSession(context.TODO(), func(sess *db.Session) error {
		for _, doc := range docs {
			if _, err := sess.Exec(`DELETE FROM `+index.name+` WHERE org_id = ? AND kind = ? AND uid = ?`, doc.OrgID, doc.Kind, doc.UID); err != nil {
				return err
			}
			for _, f := range doc.Fields {
				if _, err := sess.Exec(`INSERT INTO `+index.name+` (org_id, kind, uid, field, content) VALUES (?, ?, ?)`, doc.OrgID, doc.Kind, doc.UID, f.Field, f.Value); err != nil {
					return err
				}
			}
		}
		return nil
	})
}
func (index *sqliteFTS) Filter(query string) model.FilterWhere {
	return &sqliteFTSFilter{name: index.name, query: query}
}

type sqliteFTSFilter struct {
	name  string
	query string
}

func (filter sqliteFTSFilter) LeftJoin() string {
	return fmt.Sprintf(`(SELECT org_id, uid FROM %[1]s WHERE %[1]s.content MATCH '%[2]s') AS %[1]s ON %[1]s.org_id = dashboard.org_id AND %[1]s.uid = dashboard.uid`, filter.name, filter.query)
}

func (filter sqliteFTSFilter) Where() (string, []any) {
	return fmt.Sprintf(`%[1]s.uid IS NOT NULL`, filter.name), nil
}

func (index *sqliteFTS) Search(query string) ([]DocumentID, error) {
	docs := []DocumentID{}
	err := index.db.WithDbSession(context.TODO(), func(sess *db.Session) error {
		rows, err := sess.Query(`SELECT org_id, uid, kind FROM `+index.name+` WHERE content MATCH ?`, query)
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
