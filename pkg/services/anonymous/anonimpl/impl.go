package anonimpl

import (
	"context"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/anonymous"
	"github.com/grafana/grafana/pkg/services/anonymous/anonimpl/anonstore"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

const thirtyDays = 30 * 24 * time.Hour
const deviceIDHeader = "X-Grafana-Device-Id"

type AnonDeviceService struct {
	log        log.Logger
	localCache *localcache.CacheService
	anonStore  anonstore.AnonStore
}

func ProvideAnonymousDeviceService(usageStats usagestats.Service, authBroker authn.Service,
	anonStore anonstore.AnonStore, cfg *setting.Cfg, orgService org.Service) *AnonDeviceService {
	a := &AnonDeviceService{
		log:        log.New("anonymous-session-service"),
		localCache: localcache.New(29*time.Minute, 15*time.Minute),
		anonStore:  anonStore,
	}

	usageStats.RegisterMetricsFunc(a.usageStatFn)

	anonClient := &Anonymous{
		cfg:               cfg,
		log:               log.New("authn.anonymous"),
		orgService:        orgService,
		anonDeviceService: a,
	}

	if anonClient.cfg.AnonymousEnabled {
		authBroker.RegisterClient(anonClient)
	}

	return a
}

func (a *AnonDeviceService) usageStatFn(ctx context.Context) (map[string]any, error) {
	// Count the number of unique devices that have been updated in the last 30 days.
	// One minute is added to the end time as mysql has a precision of seconds and it will break tests that write too fast.
	anonUIDeviceCount, err := a.anonStore.CountDevices(ctx, time.Now().Add(-thirtyDays), time.Now().Add(time.Minute))
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"stats.anonymous.device.ui.count": anonUIDeviceCount,
	}, nil
}

func (a *AnonDeviceService) tagDeviceUI(ctx context.Context, httpReq *http.Request, device *anonstore.Device) error {
	key := device.CacheKey()

	if _, ok := a.localCache.Get(key); ok {
		return nil
	}

	a.localCache.SetDefault(key, struct{}{})

	if setting.Env == setting.Dev {
		a.log.Debug("Tagging device for UI", "deviceID", device.DeviceID, "device", device, "key", key)
	}

	if err := a.anonStore.CreateOrUpdateDevice(ctx, device); err != nil {
		return err
	}

	return nil
}

func (a *AnonDeviceService) TagDevice(ctx context.Context, httpReq *http.Request, kind anonymous.DeviceKind) error {
	deviceID := httpReq.Header.Get(deviceIDHeader)
	if deviceID == "" {
		return nil
	}

	addr := web.RemoteAddr(httpReq)
	ip, err := network.GetIPFromAddress(addr)
	if err != nil {
		a.log.Debug("Failed to parse ip from address", "addr", addr)
		return nil
	}

	clientIPStr := ip.String()
	if len(ip) == 0 {
		clientIPStr = ""
	}

	taggedDevice := &anonstore.Device{
		DeviceID:  deviceID,
		ClientIP:  clientIPStr,
		UserAgent: httpReq.UserAgent(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	err = a.tagDeviceUI(ctx, httpReq, taggedDevice)
	if err != nil {
		a.log.Debug("Failed to tag device for UI", "error", err)
	}

	return nil
}
