package kine

import (
	"context"
	"fmt"
	"path"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/k3s-io/kine/pkg/endpoint"
)

const DEFAULT_HOST = "tcp://127.0.0.1:2379"

// Service is the interface for the kine service.
type Service interface {
	services.Service
}

type EtcdProvider interface {
	GetConfig() *endpoint.ETCDConfig
}

type service struct {
	*services.BasicService
	etcdConfig       *endpoint.ETCDConfig
	connectionString string
}

func ProvideService(sqlStoreService *sqlstore.SQLStore) (*service, error) {
	dbconfig := sqlStoreService.GetDbCfg()
	connectionString, err := buildConnectionString(dbconfig)
	if err != nil {
		return nil, err
	}
	s := &service{connectionString: connectionString}
	s.BasicService = services.NewBasicService(s.start, s.running, nil)
	return s, nil
}

func (s *service) GetConfig() *endpoint.ETCDConfig {
	return s.etcdConfig
}

func (s *service) start(ctx context.Context) error {
	config := endpoint.Config{
		Endpoint: s.connectionString,
		Listener: DEFAULT_HOST,
	}
	etcdConfig, err := endpoint.Listen(ctx, config)
	if err != nil {
		return err
	}
	s.etcdConfig = &etcdConfig
	return nil
}

func (s *service) running(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

func buildConnectionString(dbconfig sqlstore.DatabaseConfig) (string, error) {
	connectionString := ""

	switch dbconfig.Type {
	case "sqlite3", "sqlite":
		connectionString = endpoint.SQLiteBackend + "://" + path.Join(path.Dir(dbconfig.Path), "k8s", "kubernetes.db")
	case endpoint.PostgresBackend:
		// TODO: support additional options
		connectionString = endpoint.PostgresBackend + "://" + dbconfig.Host + "/kubernetes"
	case endpoint.MySQLBackend:
		// TODO: support additional options
		connectionString = endpoint.MySQLBackend + "://" + dbconfig.Host + "/kubernetes"
	default:
		return "", fmt.Errorf("unknown backend: %s", dbconfig.Type)
	}

	return connectionString, nil
}
