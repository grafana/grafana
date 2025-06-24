package metadata

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
)

type auditLogConfigDB struct {
	// Kubernetes Metadata
	GUID        string
	Name        string
	Namespace   string
	Annotations string // map[string]string
	Labels      string // map[string]string
	Created     int64
	CreatedBy   string
	Updated     int64
	UpdatedBy   string

	// Spec
	StdoutEnable bool

	FileEnable        bool
	FilePath          sql.NullString
	FileMaxFileSizeMB sql.NullInt32
	FileMaxFiles      sql.NullInt32

	LokiEnable             bool
	LokiURLSecureValueName sql.NullString
	LokiProtocol           sql.NullString
	LokiTLS                sql.NullBool
}

// toKubernetes maps a DB row into a Kubernetes resource (metadata + spec).
func (kp *auditLogConfigDB) toKubernetes() (*secretv0alpha1.AuditLogConfig, error) {
	annotations := make(map[string]string, 0)
	if kp.Annotations != "" {
		if err := json.Unmarshal([]byte(kp.Annotations), &annotations); err != nil {
			return nil, fmt.Errorf("failed to unmarshal annotations: %w", err)
		}
	}

	labels := make(map[string]string, 0)
	if kp.Labels != "" {
		if err := json.Unmarshal([]byte(kp.Labels), &labels); err != nil {
			return nil, fmt.Errorf("failed to unmarshal labels: %w", err)
		}
	}

	resource := &secretv0alpha1.AuditLogConfig{
		Spec: secretv0alpha1.AuditLogConfigSpec{},
	}

	if kp.StdoutEnable {
		resource.Spec.StdoutLogger = &secretv0alpha1.StdoutLogger{
			Enable: kp.StdoutEnable,
		}
	}

	if kp.FileEnable {
		resource.Spec.FileLogger = &secretv0alpha1.FileLogger{
			Enable:        kp.FileEnable,
			Path:          kp.FilePath.String,
			MaxFileSizeMB: kp.FileMaxFileSizeMB.Int32,
			MaxFiles:      kp.FileMaxFiles.Int32,
		}
	}

	if kp.LokiEnable {
		resource.Spec.LokiLogger = &secretv0alpha1.LokiLogger{
			Enable: kp.LokiEnable,
			URL: secretv0alpha1.LokiLoggerAddress{
				SecureValueName: kp.LokiURLSecureValueName.String,
			},
			Protocol: secretv0alpha1.LokiLoggerProtocol(kp.LokiProtocol.String),
			TLS:      kp.LokiTLS.Bool,
		}
	}

	// Set all meta fields here for consistency.
	meta, err := utils.MetaAccessor(resource)
	if err != nil {
		return nil, fmt.Errorf("failed to get meta accessor: %w", err)
	}

	updated := time.Unix(kp.Updated, 0).UTC()

	meta.SetUID(types.UID(kp.GUID))
	meta.SetName(kp.Name)
	meta.SetNamespace(kp.Namespace)
	meta.SetAnnotations(annotations)
	meta.SetLabels(labels)
	meta.SetCreatedBy(kp.CreatedBy)
	meta.SetCreationTimestamp(metav1.NewTime(time.Unix(kp.Created, 0).UTC()))
	meta.SetUpdatedBy(kp.UpdatedBy)
	meta.SetUpdatedTimestamp(&updated)
	meta.SetResourceVersionInt64(kp.Updated)

	return resource, nil
}

func toAuditLogConfigCreateRow(cfg *secretv0alpha1.AuditLogConfig, actorUID string) (*auditLogConfigDB, error) {
	row, err := toAuditLogConfigRow(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to map to row: %w", err)
	}

	now := time.Now().UTC().Unix()

	row.GUID = uuid.New().String()
	row.Created = now
	row.CreatedBy = actorUID
	row.Updated = now
	row.UpdatedBy = actorUID

	return row, nil
}

func toAuditLogConfigUpdateRow(currentRow *auditLogConfigDB, newCfg *secretv0alpha1.AuditLogConfig, actorUID string) (*auditLogConfigDB, error) {
	row, err := toAuditLogConfigRow(newCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to map to row: %w", err)
	}

	now := time.Now().UTC().Unix()

	row.GUID = currentRow.GUID
	row.Created = currentRow.Created
	row.CreatedBy = currentRow.CreatedBy
	row.Updated = now
	row.UpdatedBy = actorUID

	return row, nil
}

func toAuditLogConfigRow(cfg *secretv0alpha1.AuditLogConfig) (*auditLogConfigDB, error) {
	var annotations string
	if len(cfg.Annotations) > 0 {
		encodedAnnotations, err := json.Marshal(cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to encode annotations: %w", err)
		}

		annotations = string(encodedAnnotations)
	}

	var labels string
	if len(cfg.Labels) > 0 {
		encodedLabels, err := json.Marshal(cfg.Labels)
		if err != nil {
			return nil, fmt.Errorf("failed to encode labels: %w", err)
		}

		labels = string(encodedLabels)
	}

	meta, err := utils.MetaAccessor(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to get meta accessor: %w", err)
	}

	if meta.GetFolder() != "" {
		return nil, fmt.Errorf("folders are not supported")
	}

	updatedTimestamp, err := meta.GetResourceVersionInt64()
	if err != nil {
		return nil, fmt.Errorf("failed to get resource version: %w", err)
	}

	var (
		filePath          sql.NullString
		fileMaxFileSizeMB sql.NullInt32
		fileMaxFiles      sql.NullInt32
	)
	if cfg.Spec.FileLogger != nil {
		filePath = sql.NullString{
			String: cfg.Spec.FileLogger.Path,
			Valid:  true,
		}
		fileMaxFileSizeMB = sql.NullInt32{
			Int32: cfg.Spec.FileLogger.MaxFileSizeMB,
			Valid: true,
		}
		fileMaxFiles = sql.NullInt32{
			Int32: cfg.Spec.FileLogger.MaxFiles,
			Valid: true,
		}
	}

	var (
		lokiURLSecureValueName sql.NullString
		lokiProtocol           sql.NullString
		lokiTLS                sql.NullBool
	)
	if cfg.Spec.LokiLogger != nil {
		lokiURLSecureValueName = sql.NullString{
			String: cfg.Spec.LokiLogger.URL.SecureValueName,
			Valid:  cfg.Spec.LokiLogger.URL.SecureValueName != "",
		}
		lokiProtocol = sql.NullString{
			String: string(cfg.Spec.LokiLogger.Protocol),
			Valid:  cfg.Spec.LokiLogger.Protocol != "",
		}
		lokiTLS = sql.NullBool{
			Bool:  cfg.Spec.LokiLogger.TLS,
			Valid: true,
		}
	}

	return &auditLogConfigDB{
		// Kubernetes Metadata
		GUID:        string(cfg.UID),
		Name:        cfg.Name,
		Namespace:   cfg.Namespace,
		Annotations: annotations,
		Labels:      labels,
		Created:     meta.GetCreationTimestamp().Unix(),
		CreatedBy:   meta.GetCreatedBy(),
		Updated:     updatedTimestamp,
		UpdatedBy:   meta.GetUpdatedBy(),

		// Spec
		StdoutEnable: cfg.Spec.StdoutLogger != nil && cfg.Spec.StdoutLogger.Enable,

		FileEnable:        cfg.Spec.FileLogger != nil && cfg.Spec.FileLogger.Enable,
		FilePath:          filePath,
		FileMaxFileSizeMB: fileMaxFileSizeMB,
		FileMaxFiles:      fileMaxFiles,

		LokiEnable:             cfg.Spec.LokiLogger != nil && cfg.Spec.LokiLogger.Enable,
		LokiURLSecureValueName: lokiURLSecureValueName,
		LokiProtocol:           lokiProtocol,
		LokiTLS:                lokiTLS,
	}, nil
}
