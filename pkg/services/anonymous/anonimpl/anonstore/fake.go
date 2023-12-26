package anonstore

import (
	"context"
	"time"
)

type FakeAnonStore struct {
}

func (s *FakeAnonStore) ListDevices(ctx context.Context, from *time.Time, to *time.Time) ([]*Device, error) {
	return nil, nil
}

func (s *FakeAnonStore) CreateOrUpdateDevice(ctx context.Context, device *Device) error {
	return nil
}

func (s *FakeAnonStore) CountDevices(ctx context.Context, from time.Time, to time.Time) (int64, error) {
	return 0, nil
}
