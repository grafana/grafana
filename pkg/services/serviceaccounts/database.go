package serviceaccounts

import "github.com/grafana/grafana/pkg/services/sqlstore"

type serviceAccountsStore struct {
	sqlStore *sqlstore.SQLStore
}

func NewServiceAccountsStore(store *sqlstore.SQLStore) *serviceAccountsStore {
	return &serviceAccountsStore{
		sqlStore: store,
	}
}
