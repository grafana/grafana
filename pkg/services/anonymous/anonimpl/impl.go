package anonimpl

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/anonymous"
	"github.com/grafana/grafana/pkg/web"
)

const thirtyDays = 30 * 24 * time.Hour

type Device struct {
	Kind      anonymous.DeviceKind `json:"kind"`
	IP        string               `json:"ip"`
	UserAgent string               `json:"user_agent"`
	LastSeen  time.Time            `json:"last_seen"`
}

func (a *Device) Key() (string, error) {
	key := strings.Builder{}
	key.WriteString(a.IP)
	key.WriteString(a.UserAgent)

	hash := fnv.New128a()
	if _, err := hash.Write([]byte(key.String())); err != nil {
		return "", fmt.Errorf("failed to write to hash: %w", err)
	}

	return strings.Join([]string{string(a.Kind), hex.EncodeToString(hash.Sum(nil))}, ":"), nil
}

type AnonDeviceService struct {
	remoteCache remotecache.CacheStorage
	log         log.Logger
	localCache  *localcache.CacheService
}

func ProvideAnonymousDeviceService(remoteCache remotecache.CacheStorage, usageStats usagestats.Service) *AnonDeviceService {
	a := &AnonDeviceService{
		remoteCache: remoteCache,
		log:         log.New("anonymous-session-service"),
		localCache:  localcache.New(29*time.Minute, 15*time.Minute),
	}

	usageStats.RegisterMetricsFunc(a.usageStatFn)

	return a
}

func (a *AnonDeviceService) usageStatFn(ctx context.Context) (map[string]interface{}, error) {
	anonDeviceCount, err := a.remoteCache.Count(ctx, string(anonymous.AnonDevice))
	if err != nil {
		return nil, nil
	}

	authedDeviceCount, err := a.remoteCache.Count(ctx, string(anonymous.AuthedDevice))
	if err != nil {
		return nil, nil
	}

	return map[string]interface{}{
		"stats.anonymous.session.count": anonDeviceCount, // keep session for legacy data
		"stats.users.device.count":      authedDeviceCount,
	}, nil
}

func (a *AnonDeviceService) untagDevice(ctx context.Context, device *Device) error {
	key, err := device.Key()
	if err != nil {
		return err
	}

	if err := a.remoteCache.Delete(ctx, key); err != nil {
		return err
	}

	return nil
}

func (a *AnonDeviceService) TagDevice(ctx context.Context, httpReq *http.Request, kind anonymous.DeviceKind) error {
	addr := web.RemoteAddr(httpReq)
	ip, err := network.GetIPFromAddress(addr)
	if err != nil {
		a.log.Debug("failed to parse ip from address", "addr", addr)
		return nil
	}

	clientIPStr := ip.String()
	if len(ip) == 0 {
		clientIPStr = ""
	}

	taggedDevice := &Device{
		Kind:      kind,
		IP:        clientIPStr,
		UserAgent: httpReq.UserAgent(),
		LastSeen:  time.Now().UTC(),
	}

	key, err := taggedDevice.Key()
	if err != nil {
		return err
	}

	if _, ok := a.localCache.Get(key); ok {
		return nil
	}

	a.localCache.SetDefault(key, struct{}{})

	deviceJSON, err := json.Marshal(taggedDevice)
	if err != nil {
		return err
	}

	if err := a.remoteCache.Set(ctx, key, deviceJSON, thirtyDays); err != nil {
		return err
	}

	// remove existing tag when device switches to another kind
	untagKind := anonymous.AnonDevice
	if kind == anonymous.AnonDevice {
		untagKind = anonymous.AuthedDevice
	}
	if err := a.untagDevice(ctx, &Device{
		Kind:      untagKind,
		IP:        taggedDevice.IP,
		UserAgent: taggedDevice.UserAgent,
	}); err != nil {
		return err
	}

	return nil
}
