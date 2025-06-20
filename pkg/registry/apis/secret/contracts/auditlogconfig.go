package contracts

import (
	"context"
	"errors"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

var (
	ErrAuditLogConfigNotFound = errors.New("audit log config not found")
)

type AuditLogConfigStorage interface {
	Create(ctx context.Context, config *secretv0alpha1.AuditLogConfig, actorUID string) (*secretv0alpha1.AuditLogConfig, error)
	Read(ctx context.Context, namespace xkube.Namespace) (*secretv0alpha1.AuditLogConfig, error)
	Update(ctx context.Context, config *secretv0alpha1.AuditLogConfig, actorUID string) (*secretv0alpha1.AuditLogConfig, error)
	Delete(ctx context.Context, namespace xkube.Namespace) error
	List(ctx context.Context, namespace xkube.Namespace) ([]secretv0alpha1.AuditLogConfig, error)
}
