package anonstore

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const cacheKeyPrefix = "anon-device"
const keepFor = time.Hour * 24 * 61

type AnonDBStore struct {
	sqlStore   db.DB
	serverLock *serverlock.ServerLockService
	log        log.Logger
}

type Device struct {
	ID        int64     `json:"-" db:"id"`
	DeviceID  string    `json:"device_id" db:"device_id"`
	ClientIP  string    `json:"client_ip" db:"client_ip"`
	UserAgent string    `json:"user_agent" db:"user_agent"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

func (a *Device) CacheKey() string {
	return strings.Join([]string{cacheKeyPrefix, a.DeviceID}, ":")
}

type AnonStore interface {
	// ListDevices returns all devices that have been updated between the given times.
	ListDevices(ctx context.Context, from *time.Time, to *time.Time) ([]*Device, error)
	// CreateOrUpdateDevice creates or updates a device.
	CreateOrUpdateDevice(ctx context.Context, device *Device) error
	// CountDevices returns the number of devices that have been updated between the given times.
	CountDevices(ctx context.Context, from time.Time, to time.Time) (int64, error)
	// DeleteDevice deletes a device by its ID.
	DeleteDevice(ctx context.Context, deviceID string) error
}

func ProvideAnonDBStore(sqlStore db.DB, serverLockService *serverlock.ServerLockService) *AnonDBStore {
	return &AnonDBStore{sqlStore: sqlStore, serverLock: serverLockService, log: log.New("anonstore")}
}

func (s *AnonDBStore) ListDevices(ctx context.Context, from *time.Time, to *time.Time) ([]*Device, error) {
	devices := []*Device{}
	query := "SELECT * FROM anon_device"
	args := []any{}
	if from != nil && to != nil {
		query += " WHERE updated_at BETWEEN ? AND ?"
		args = append(args, from.UTC(), to.UTC())
	}
	err := s.sqlStore.GetSqlxSession().Select(ctx, &devices, query, args...)
	if err != nil {
		return nil, err
	}
	return devices, nil
}

func (s *AnonDBStore) CreateOrUpdateDevice(ctx context.Context, device *Device) error {
	var query string

	args := []any{device.DeviceID, device.ClientIP, device.UserAgent,
		device.CreatedAt.UTC(), device.UpdatedAt.UTC()}
	switch s.sqlStore.GetDBType() {
	case migrator.Postgres:
		query = `INSERT INTO anon_device (device_id, client_ip, user_agent, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (device_id) DO UPDATE SET
client_ip = $2,
user_agent = $3,
updated_at = $5
RETURNING id`
	case migrator.MySQL:
		query = `INSERT INTO anon_device (device_id, client_ip, user_agent, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
client_ip = VALUES(client_ip),
user_agent = VALUES(user_agent),
updated_at = VALUES(updated_at)`
	case migrator.SQLite:
		query = `INSERT INTO anon_device (device_id, client_ip, user_agent, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT (device_id) DO UPDATE SET
client_ip = excluded.client_ip,
user_agent = excluded.user_agent,
updated_at = excluded.updated_at`
	default:
		return fmt.Errorf("unsupported database driver: %s", s.sqlStore.GetDBType())
	}

	_, err := s.sqlStore.GetSqlxSession().Exec(ctx, query, args...)
	return err
}

func (s *AnonDBStore) CountDevices(ctx context.Context, from time.Time, to time.Time) (int64, error) {
	var count int64
	err := s.sqlStore.GetSqlxSession().Get(ctx, &count, "SELECT COUNT(*) FROM anon_device WHERE updated_at BETWEEN ? AND ?", from.UTC(), to.UTC())
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (s *AnonDBStore) DeleteDevice(ctx context.Context, deviceID string) error {
	_, err := s.sqlStore.GetSqlxSession().Exec(ctx, "DELETE FROM anon_device WHERE device_id = ?", deviceID)
	if err != nil {
		return err
	}
	return nil
}

// deleteOldDevices deletes all devices that have no been updated since the given time.
func (s *AnonDBStore) deleteOldDevices(ctx context.Context, olderThan time.Time) error {
	_, err := s.sqlStore.GetSqlxSession().Exec(ctx, "DELETE FROM anon_device WHERE updated_at <= ?", olderThan.UTC())
	if err != nil {
		return err
	}
	return nil
}

func (s *AnonDBStore) Run(ctx context.Context) error {
	ticker := time.NewTicker(2 * time.Hour)

	for {
		select {
		case <-ticker.C:
			err := s.serverLock.LockAndExecute(ctx, "cleanup old anon devices", time.Hour*10, func(context.Context) {
				if err := s.deleteOldDevices(ctx, time.Now().Add(-keepFor)); err != nil {
					s.log.Error("An error occurred while deleting old anon devices", "err", err)
				}
			})
			if err != nil {
				s.log.Error("Failed to lock and execute cleanup old anon devices", "error", err)
			}

		case <-ctx.Done():
			return ctx.Err()
		}
	}
}
