package anonstore

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const cacheKeyPrefix = "anon-device"

type AnonDBStore struct {
	sqlStore db.DB
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
	ListDevices(ctx context.Context, from *time.Time, to *time.Time) ([]*Device, error)
	CreateOrUpdateDevice(ctx context.Context, device *Device) error
	CountDevices(ctx context.Context, from time.Time, to time.Time) (int64, error)
}

func ProvideAnonDBStore(sqlStore db.DB) *AnonDBStore {
	return &AnonDBStore{sqlStore: sqlStore}
}

func (s *AnonDBStore) ListDevices(ctx context.Context, from *time.Time, to *time.Time) ([]*Device, error) {
	devices := []*Device{}
	query := "SELECT * FROM anon_device"
	args := []any{}
	if from != nil && to != nil {
		query += " WHERE updated_at BETWEEN ? AND ?"
		args = append(args, from, to)
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
		query = `
			INSERT INTO anon_device (device_id, client_ip, user_agent, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (device_id) DO UPDATE SET
				client_ip = $2,
				user_agent = $3,
				updated_at = $5
			RETURNING id
		`
	case migrator.MySQL:
		query = `
			INSERT INTO anon_device (device_id, client_ip, user_agent, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				client_ip = VALUES(client_ip),
				user_agent = VALUES(user_agent),
				updated_at = VALUES(updated_at)
		`
	case migrator.SQLite:
		query = `
			INSERT INTO anon_device (device_id, client_ip, user_agent, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT (device_id) DO UPDATE SET
				client_ip = excluded.client_ip,
				user_agent = excluded.user_agent,
				updated_at = excluded.updated_at
		`
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
