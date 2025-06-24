package contracts

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

const SecretAuditLogServiceIdentity = "secret-audit-log"

type AuditLogSinkType string

const (
	AuditLogSinkTypeStdout AuditLogSinkType = "stdout"
	AuditLogSinkTypeFile   AuditLogSinkType = "file"
	AuditLogSinkTypeLoki   AuditLogSinkType = "loki"
)

type AuditLogSinks map[AuditLogSinkType]struct{}

var AvailableAuditLogSinks = AuditLogSinks{
	AuditLogSinkTypeStdout: {},
	AuditLogSinkTypeFile:   {},
	AuditLogSinkTypeLoki:   {},
}

type AuditLogActionStatus string

const (
	AuditLogActionStatusOK           AuditLogActionStatus = "ok"
	AuditLogActionStatusUnauthorized AuditLogActionStatus = "unauthorized"
	AuditLogActionStatusError        AuditLogActionStatus = "error"
)

type AuditLogActionType string

const (
	AuditLogActionTypeCreate  AuditLogActionType = "create"
	AuditLogActionTypeUpdate  AuditLogActionType = "update"
	AuditLogActionTypeDelete  AuditLogActionType = "delete"
	AuditLogActionTypeRead    AuditLogActionType = "read"
	AuditLogActionTypeList    AuditLogActionType = "list"
	AuditLogActionTypeDecrypt AuditLogActionType = "decrypt"
)

type AuditLogEntry struct {
	Namespace          xkube.Namespace      `json:"namespace"`
	ObservedAt         time.Time            `json:"-"`
	ActorUID           string               `json:"actor_uid"`
	Action             AuditLogActionType   `json:"action"`
	TargetResourceKind string               `json:"target_resource_kind"`
	TargetResourceName string               `json:"target_resource_name"`
	ActionStatus       AuditLogActionStatus `json:"action_status"`
}

func (e AuditLogEntry) Console() (pairs []any, err error) {
	return []any{
		"namespace", e.Namespace,
		"observed_at", e.ObservedAt,
		"actor_uid", e.ActorUID,
		"action", e.Action,
		"target_resource_kind", e.TargetResourceKind,
		"target_resource_name", e.TargetResourceName,
		"action_status", e.ActionStatus,
	}, nil
}

func (e AuditLogEntry) File() (encoded []byte, err error) {
	return json.Marshal(e)
}

func (e AuditLogEntry) Loki() (encoded []byte, observedAt time.Time, err error) {
	encoded, err = json.Marshal(e)
	if err != nil {
		return nil, time.Time{}, err
	}

	return encoded, e.ObservedAt, nil
}

type AuditLogProcessor interface {
	Process(ctx context.Context, entry AuditLogEntry) error
}

type AuditLogPublisher interface {
	Publish(ctx context.Context, entry AuditLogEntry) error
}

type AuditLogConsumer interface {
	Consume(ctx context.Context) error
}
