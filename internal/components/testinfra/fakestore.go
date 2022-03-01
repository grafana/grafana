package testinfra

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/internal/components/store"
)

type FakeStore struct {
	objects map[string]store.UniqueObject
}

func (s FakeStore) Get(ctx context.Context, uid string) (store.UniqueObject, error) {
	o, ok := s.objects[uid]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return o, nil
}

func (s FakeStore) Insert(ctx context.Context, o store.UniqueObject) error {
	s.objects[string(o.GetIdentifier())] = o
	return nil
}

func (s FakeStore) Update(ctx context.Context, o store.UniqueObject) error {
	s.objects[string(o.GetIdentifier())] = o
	return nil
}

func (s FakeStore) Delete(ctx context.Context, uid string) error {
	delete(s.objects, uid)
	return nil
}

/*
func GetTestStore(t *testing.T) store.Store {
	ossMigrations := migrations.ProvideOSSMigrations()
	// this causes cycle dependency failures
	sqlStore, err := sqlstore.ProvideServiceForTests(ossMigrations)
	require.NoError(t, err)

	return sqlstore.ProvideDataSourceSchemaStore(sqlStore)
}
*/