package anonstore

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const cacheKeyPrefix = "anon-device"
const anonymousDeviceExpiration = 30 * 24 * time.Hour

var ErrDeviceLimitReached = fmt.Errorf("device limit reached")

type AnonDBStore struct {
	sqlStore    db.DB
	log         log.Logger
	deviceLimit int64
}

type Device struct {
	ID        int64     `json:"-" xorm:"id" db:"id"`
	DeviceID  string    `json:"deviceId" xorm:"device_id" db:"device_id"`
	ClientIP  string    `json:"clientIp" xorm:"client_ip" db:"client_ip"`
	UserAgent string    `json:"userAgent" xorm:"user_agent" db:"user_agent"`
	CreatedAt time.Time `json:"createdAt" xorm:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" xorm:"updated_at" db:"updated_at"`
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
	// DeleteDevicesOlderThan deletes all devices that have no been updated since the given time.
	DeleteDevicesOlderThan(ctx context.Context, olderThan time.Time) error
}

func ProvideAnonDBStore(sqlStore db.DB, deviceLimit int64) *AnonDBStore {
	return &AnonDBStore{sqlStore: sqlStore, log: log.New("anonstore"), deviceLimit: deviceLimit}
}

func (s *AnonDBStore) ListDevices(ctx context.Context, from *time.Time, to *time.Time) ([]*Device, error) {
	devices := []*Device{}
	query := "SELECT * FROM anon_device"
	args := []any{}
	if from != nil && to != nil {
		query += " WHERE updated_at BETWEEN ? AND ?"
		args = append(args, from.UTC(), to.UTC())
	}

	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		return dbSession.SQL(query, args...).Find(&devices)
	})

	return devices, err
}

// updateDevice updates a device if it exists and has been updated between the given times.
func (s *AnonDBStore) updateDevice(ctx context.Context, device *Device) error {
	const query = `UPDATE anon_device SET
client_ip = ?,
user_agent = ?,
updated_at = ?
WHERE device_id = ? AND updated_at BETWEEN ? AND ?`

	args := []interface{}{device.ClientIP, device.UserAgent, device.UpdatedAt.UTC(), device.DeviceID,
		device.UpdatedAt.UTC().Add(-anonymousDeviceExpiration), device.UpdatedAt.UTC().Add(time.Minute),
	}
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		args = append([]interface{}{query}, args...)
		result, err := dbSession.Exec(args...)
		if err != nil {
			return err
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return err
		}

		if rowsAffected == 0 {
			return ErrDeviceLimitReached
		}

		return nil
	})

	return err
}

func (s *AnonDBStore) CreateOrUpdateDevice(ctx context.Context, device *Device) error {
	var query string

	// if device limit is reached, only update devices
	if s.deviceLimit > 0 {
		count, err := s.CountDevices(ctx, time.Now().UTC().Add(-anonymousDeviceExpiration), time.Now().UTC().Add(time.Minute))
		if err != nil {
			return err
		}

		if count >= s.deviceLimit {
			return s.updateDevice(ctx, device)
		}
	}

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

	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		args = append([]any{query}, args...)
		_, err := dbSession.Exec(args...)
		return err
	})

	return err
}

func (s *AnonDBStore) CountDevices(ctx context.Context, from time.Time, to time.Time) (int64, error) {
	var count int64
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		_, err := dbSession.SQL("SELECT COUNT(*) FROM anon_device WHERE updated_at BETWEEN ? AND ?", from.UTC(), to.UTC()).Get(&count)
		return err
	})

	return count, err
}

func (s *AnonDBStore) DeleteDevice(ctx context.Context, deviceID string) error {
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		_, err := dbSession.Exec("DELETE FROM anon_device WHERE device_id = ?", deviceID)
		return err
	})

	return err
}

// deleteOldDevices deletes all devices that have no been updated since the given time.
func (s *AnonDBStore) DeleteDevicesOlderThan(ctx context.Context, olderThan time.Time) error {
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		_, err := dbSession.Exec("DELETE FROM anon_device WHERE updated_at <= ?", olderThan.UTC())
		return err
	})

	return err
}
