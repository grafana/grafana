package metadata

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type auditLogConfigStore struct {
	db      contracts.Database
	dialect sqltemplate.Dialect
	tracer  trace.Tracer
}

func ProvideAuditLogConfigStore(db contracts.Database, tracer trace.Tracer, features featuremgmt.FeatureToggles) contracts.AuditLogConfigStorage {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &auditLogConfigStore{}
	}

	return &auditLogConfigStore{
		db:      db,
		dialect: sqltemplate.DialectForDriver(db.DriverName()),
		tracer:  tracer,
	}
}

func (s *auditLogConfigStore) Create(ctx context.Context, config *secretv0alpha1.AuditLogConfig, actorUID string) (*secretv0alpha1.AuditLogConfig, error) {
	ctx, span := s.tracer.Start(ctx, "AuditLogConfigStorage.Create", trace.WithAttributes(
		attribute.String("name", config.GetName()),
		attribute.String("namespace", config.GetNamespace()),
		attribute.String("actorUID", actorUID),
	))
	defer span.End()

	row, err := toAuditLogConfigCreateRow(config, actorUID)
	if err != nil {
		return nil, fmt.Errorf("failed to create row: %w", err)
	}

	req := createAuditLogConfig{
		SQLTemplate: sqltemplate.New(s.dialect),
		Row:         row,
	}

	query, err := sqltemplate.Execute(sqlAuditLogConfigCreate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlAuditLogConfigCreate.Name(), err)
	}

	result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("inserting row: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("getting rows affected: %w", err)
	}

	if rowsAffected != 1 {
		return nil, fmt.Errorf("expected 1 row affected, got %d for %s on %s", rowsAffected, config.Name, config.Namespace)
	}

	createdAuditLogConfig, err := row.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return createdAuditLogConfig, nil
}

func (s *auditLogConfigStore) Read(ctx context.Context, namespace xkube.Namespace) (*secretv0alpha1.AuditLogConfig, error) {
	ctx, span := s.tracer.Start(ctx, "AuditLogConfigStorage.Read", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	req := readAuditLogConfig{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
	}

	query, err := sqltemplate.Execute(sqlAuditLogConfigRead, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlAuditLogConfigRead.Name(), err)
	}

	rows, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("querying audit log config: %w", err)
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("reading audit log config: %w", err)
		}

		return nil, fmt.Errorf("%w for namespace %s", contracts.ErrAuditLogConfigNotFound, namespace)
	}

	var row auditLogConfigDB
	if err := rows.Scan(
		&row.GUID, &row.Name, &row.Namespace, &row.Annotations, &row.Labels, &row.Created, &row.CreatedBy, &row.Updated, &row.UpdatedBy,
		&row.StdoutEnable, &row.FileEnable, &row.FilePath, &row.LokiEnable, &row.LokiURLSecureValueName, &row.LokiProtocol, &row.LokiTLS,
	); err != nil {
		return nil, fmt.Errorf("scanning audit log config row: %w", err)
	}

	return row.toKubernetes()
}

func (s *auditLogConfigStore) Update(ctx context.Context, config *secretv0alpha1.AuditLogConfig, actorUID string) (*secretv0alpha1.AuditLogConfig, error) {
	panic("not implemented yet")
	return nil, nil
}

func (s *auditLogConfigStore) Delete(ctx context.Context, namespace xkube.Namespace) error {
	panic("not implemented yet")
	return nil
}

func (s *auditLogConfigStore) List(ctx context.Context, namespace xkube.Namespace) ([]secretv0alpha1.AuditLogConfig, error) {
	panic("not implemented yet")
	return nil, nil
}
