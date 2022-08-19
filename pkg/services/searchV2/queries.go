package searchV2

import (
	"bytes"
	"context"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/searchV2/dslookup"
	"github.com/grafana/grafana/pkg/services/searchV2/extract"
	"github.com/grafana/grafana/pkg/services/store"
)

type storageQueriesLoader struct {
	storage store.StorageService
	logger  log.Logger
}

func newStorageQueriesLoader(storage store.StorageService) *storageQueriesLoader {
	return &storageQueriesLoader{storage: storage, logger: log.New("storageQueriesLoader")}
}

type query struct {
	uid     string
	slug    string
	created time.Time
	updated time.Time
	info    *extract.QueryInfo
}

func isQuery(f *filestorage.File) bool {
	for k, v := range f.Properties {
		if k == "kind" {
			return store.EntityType(v) == store.EntityTypeQuery
		}
	}
	return false
}

func (l storageQueriesLoader) LoadQueries(ctx context.Context, orgID int64, uid string, lookup dslookup.DatasourceLookup) ([]query, error) {
	if uid != "" {
		file, err := l.storage.Read(ctx, store.QueriesSearch, uid)
		if err != nil {
			return nil, nil
		}

		if file == nil {
			return []query{}, nil
		}

		info, err := extract.ReadQuery(bytes.NewReader(file.Contents), file.FullPath, lookup)
		return []query{
			{
				uid:     file.FullPath,
				slug:    file.FullPath,
				created: file.Created,
				updated: file.Modified,
				info:    info,
			},
		}, nil
	}

	queries := make([]query, 0)

	resp, err := l.storage.ListRaw(ctx, store.QueriesSearch, store.SystemQueriesStorage, &filestorage.ListOptions{WithFiles: true, WithFolders: false, WithContents: true})
	if err != nil {
		return queries, err
	}
	for _, file := range resp.Files {
		if !isQuery(file) {
			continue
		}

		uid := store.RootSystem + file.FullPath
		info, err := extract.ReadQuery(bytes.NewReader(file.Contents), uid, lookup)
		if err != nil {
			return nil, err
		}

		queries = append(queries, query{
			uid:     uid,
			slug:    uid,
			created: file.Created,
			updated: file.Modified,
			info:    info,
		})
	}

	// name is configurable - lets hardcode for now
	hardcodedGitStorage := "it"
	resp, err = l.storage.ListRaw(ctx, store.QueriesSearch, hardcodedGitStorage, &filestorage.ListOptions{WithFiles: true, WithFolders: false, WithContents: true})
	l.logger.Info("Found git queries", "len", len(resp.Files))

	if err != nil {
		return queries, err
	}
	for _, file := range resp.Files {
		isQuery := l.isQueryFromGit(file)
		if !isQuery {
			continue
		}

		uid := hardcodedGitStorage + file.FullPath
		info, err := extract.ReadQuery(bytes.NewReader(file.Contents), uid, lookup)
		if err != nil {
			return nil, err
		}

		queries = append(queries, query{
			uid:     uid,
			slug:    uid,
			created: file.Created,
			updated: file.Modified,
			info:    info,
		})
	}

	return queries, nil
}

func (l storageQueriesLoader) isQueryFromGit(file *filestorage.File) bool {
	if !strings.HasSuffix(file.FullPath, ".json") {
		return false
	}

	query, err := simplejson.NewJson(file.Contents)
	if err != nil {
		l.logger.Debug("Skipping git query", "path", file.FullPath, "error", err)
		return false
	}

	l.logger.Debug("Parsing git query", "path", file.FullPath)
	_, err = query.Get("queries").Array()
	if err != nil {
		l.logger.Debug("Skipping git query - no queries array", "path", file.FullPath, "error", err)
		return false
	}

	return true
}
