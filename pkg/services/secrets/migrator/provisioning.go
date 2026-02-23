package migrator

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
)

var errNoEncryptedValue = errors.New("no encrypted value was found")

var _ SecretsRotator = provisioningSecrets{}

type provisioningSecrets struct{}

func (p provisioningSecrets) ReEncrypt(ctx context.Context, svc *manager.SecretsService, sqlStore db.DB) bool {
	return p.reEncrypt(ctx, svc, func(ctx context.Context, payload []byte) ([]byte, error) {
		return svc.Encrypt(ctx, payload, secrets.WithoutScope())
	}, sqlStore, "rotation")
}

func (p provisioningSecrets) Rollback(ctx context.Context, svc *manager.SecretsService, internal encryption.Internal, sqlStore db.DB, secretKey string) bool {
	return p.reEncrypt(ctx, svc, func(ctx context.Context, payload []byte) ([]byte, error) {
		return internal.Encrypt(ctx, payload, secretKey)
	}, sqlStore, "rollback")
}

func (p provisioningSecrets) reEncrypt(
	ctx context.Context,
	svc *manager.SecretsService,
	encrypt func(context.Context, []byte) ([]byte, error),
	sqlStore db.DB,
	action string,
) bool {
	var rows []struct {
		Guid  string
		Value []byte
	}

	if err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table("resource").Where("`group` = 'provisioning.grafana.app' AND `resource` = 'repositories'").
			Select("guid, value").
			Find(&rows)
	}); err != nil {
		logger.Warn("Could not find any provisioning secrets to re-encrypt", "error", err, "action", action)
		// resource table may not exists (when not using unified storage and right db), so we don't report error here.
		return true
	}

	var failures int

	for _, row := range rows {
		var resource map[string]any
		if err := json.Unmarshal(row.Value, &resource); err != nil {
			logger.Error("Failed to decode resource", "guid", row.Guid, "error", err, "action", action)
			failures++
			continue
		}

		err := p.reEncryptGitHubToken(ctx, svc, encrypt, sqlStore, resource)
		if err != nil && !errors.Is(err, errNoEncryptedValue) {
			logger.Error("Failed to rotate GitHub token", "guid", row.Guid, "error", err, "action", action)
			failures++
		}
		update := err == nil

		err = p.reEncryptWebhookSecret(ctx, svc, encrypt, sqlStore, resource)
		if err != nil && !errors.Is(err, errNoEncryptedValue) {
			logger.Error("Failed to rotate webhook secret", "guid", row.Guid, "error", err, "action", action)
			failures++
		}
		update = update || err == nil

		if update {
			// Do it...
			encoded, err := json.Marshal(resource)
			if err != nil {
				logger.Error("Failed to marshal resource to JSON", "guid", row.Guid, "error", err, "action", action)
				failures++
				continue
			}

			if err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
				// TODO: Figure out what resource_version is supposed to contain, and update it.
				_, err = sess.Exec("UPDATE resource SET value = ? WHERE guid = ?", string(encoded), row.Guid)
				return err
			}); err != nil {
				logger.Error("Failed to update resource with re-encrypted values", "guid", row.Guid, "error", err, "action", action)
				failures++
			}
		}
	}

	if failures > 0 {
		logger.Warn("Failed to rotate provisioning secrets", "failures", failures, "action", action)
	} else {
		logger.Info("Successfully rotated provisioning secrets", "action", action)
	}
	return failures == 0
}

func (provisioningSecrets) reEncryptGitHubToken(
	ctx context.Context,
	svc *manager.SecretsService,
	encrypt func(context.Context, []byte) ([]byte, error),
	sqlStore db.DB,
	obj map[string]any,
) error {
	spec, _ := getCast[map[string]any](obj, "spec")
	github, _ := getCast[map[string]any](spec, "github")
	b64Token, ok := getCast[string](github, "encryptedToken")
	if !ok {
		return errNoEncryptedValue
	}

	token, err := base64.StdEncoding.DecodeString(b64Token)
	if err != nil {
		return fmt.Errorf("failed to decode base64 encrypted token: %w", err)
	}

	decrypted, err := svc.Decrypt(ctx, token)
	if err != nil {
		return fmt.Errorf("failed to decrypt existing encrypted token: %w", err)
	}

	encrypted, err := encrypt(ctx, decrypted)
	if err != nil {
		return fmt.Errorf("failed to encrypt decrypted token: %w", err)
	}

	b64Token = base64.StdEncoding.EncodeToString(encrypted)
	github["encryptedToken"] = b64Token
	return nil
}

func (provisioningSecrets) reEncryptWebhookSecret(
	ctx context.Context,
	svc *manager.SecretsService,
	encrypt func(context.Context, []byte) ([]byte, error),
	sqlStore db.DB,
	obj map[string]any,
) error {
	status, _ := getCast[map[string]any](obj, "status")
	webhook, _ := getCast[map[string]any](status, "webhook")
	b64Token, ok := getCast[string](webhook, "encryptedSecret")
	if !ok {
		return errNoEncryptedValue
	}

	token, err := base64.StdEncoding.DecodeString(b64Token)
	if err != nil {
		return fmt.Errorf("failed to decode base64 encrypted secret: %w", err)
	}

	decrypted, err := svc.Decrypt(ctx, token)
	if err != nil {
		return fmt.Errorf("failed to decrypt existing encrypted secret: %w", err)
	}

	encrypted, err := encrypt(ctx, decrypted)
	if err != nil {
		return fmt.Errorf("failed to encrypt decrypted secret: %w", err)
	}

	b64Token = base64.StdEncoding.EncodeToString(encrypted)
	webhook["encryptedSecret"] = b64Token
	return nil
}

func getCast[T any](m map[string]any, name string) (T, bool) {
	if m == nil {
		var zero T
		return zero, false
	}
	anyV, ok := m[name]
	if ok {
		t, ok := anyV.(T)
		return t, ok
	}
	var zero T
	return zero, false
}
