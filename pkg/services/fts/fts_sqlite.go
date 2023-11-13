package fts

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/grn"
	"github.com/grafana/grafana/pkg/services/search/model"
)

// sqliteFTSIndex is an FTS index based on a virtual table using FTS4 plugin for SQLite.
type sqliteFTSIndex struct {
	db   db.DB
	name string
}

func (index *sqliteFTSIndex) Init() error {
	return index.db.WithDbSession(context.TODO(), func(sess *db.Session) error {
		_, err := sess.Exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ` + index.name + ` USING FTS4 (
			grn TEXT, org_id INTEGER, kind TEXT, uid TEXT, field TEXT, content TEXT)`)
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

func (index *sqliteFTSIndex) Update(docs ...Document) error {
	// TODO: batches
	return index.db.WithDbSession(context.TODO(), func(sess *db.Session) error {
		for _, doc := range docs {
			if _, err := sess.Exec(`DELETE FROM `+index.name+` WHERE grn = ?`, doc.GRN.ToGRNString()); err != nil {
				return err
			}
			for _, f := range doc.Fields {
				if _, err := sess.Exec(`INSERT INTO `+index.name+` (grn, field, content) VALUES (?, ?, ?)`,
					doc.GRN.ToGRNString(), f.Field, f.Value); err != nil {
					return err
				}
			}
		}
		return nil
	})
}
func (index *sqliteFTSIndex) Filter(query string) model.FilterWhere {
	fmt.Println("index", query)
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

func (index *sqliteFTSIndex) Search(query string) ([]grn.GRN, error) {
	grns := []grn.GRN{}
	err := index.db.WithDbSession(context.TODO(), func(sess *db.Session) error {
		rows, err := sess.Query(`SELECT grn FROM `+index.name+` WHERE content MATCH ?`, query)
		if err != nil {
			return err
		}
		for _, row := range rows {
			id := string(row["grn"])
			grns = append(grns, *grn.MustParseStr(id))
		}
		return nil
	})
	return grns, err
}
