package anonimpl

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/anonymous"
	"github.com/grafana/grafana/pkg/services/anonymous/anonimpl/anonstore"
	"github.com/grafana/grafana/pkg/services/anonymous/anonimpl/api"
	"github.com/grafana/grafana/pkg/services/anonymous/validator"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

const thirtyDays = 30 * 24 * time.Hour
const deviceIDHeader = "X-Grafana-Device-Id"
const keepFor = time.Hour * 24 * 61

type AnonDeviceService struct {
	log            log.Logger
	localCache     *localcache.CacheService
	anonStore      anonstore.AnonStore
	serverLock     *serverlock.ServerLockService
	cfg            *setting.Cfg
	limitValidator validator.AnonUserLimitValidator
}

func ProvideAnonymousDeviceService(usageStats usagestats.Service, authBroker authn.Service,
	sqlStore db.DB, cfg *setting.Cfg, orgService org.Service,
	serverLockService *serverlock.ServerLockService, accesscontrol accesscontrol.AccessControl, routeRegister routing.RouteRegister,
	validator validator.AnonUserLimitValidator,
) *AnonDeviceService {
	a := &AnonDeviceService{
		log:            log.New("anonymous-session-service"),
		localCache:     localcache.New(29*time.Minute, 15*time.Minute),
		anonStore:      anonstore.ProvideAnonDBStore(sqlStore, cfg.Anonymous.DeviceLimit),
		serverLock:     serverLockService,
		cfg:            cfg,
		limitValidator: validator,
	}

	usageStats.RegisterMetricsFunc(a.usageStatFn)

	anonClient := &Anonymous{
		cfg:               cfg,
		log:               log.New("authn.anonymous"),
		orgService:        orgService,
		anonDeviceService: a,
	}

	if cfg.Anonymous.Enabled {
		authBroker.RegisterClient(anonClient)
		authBroker.RegisterPostLoginHook(a.untagDevice, 100)
	}

	anonAPI := api.NewAnonDeviceServiceAPI(cfg, a.anonStore, accesscontrol, routeRegister)
	anonAPI.RegisterAPIEndpoints()

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

func (a *AnonDeviceService) tagDeviceUI(ctx context.Context, device *anonstore.Device) error {
	err := a.limitValidator.Validate(ctx)
	if err != nil {
		return err
	}

	key := device.CacheKey()

	if val, ok := a.localCache.Get(key); ok {
		if boolVal, ok := val.(bool); ok && !boolVal {
			return anonstore.ErrDeviceLimitReached
		}
		return nil
	}

	a.localCache.SetDefault(key, true)

	if a.cfg.Env == setting.Dev {
		a.log.Debug("Tagging device for UI", "deviceID", device.DeviceID, "device", device, "key", key)
	}

	if err := a.anonStore.CreateOrUpdateDevice(ctx, device); err != nil {
		if errors.Is(err, anonstore.ErrDeviceLimitReached) {
			a.localCache.SetDefault(key, false)
			return err
		}
		// invalidate cache if there is an error
		a.localCache.Delete(key)
		return err
	}

	return nil
}

func (a *AnonDeviceService) untagDevice(ctx context.Context, _ *authn.Identity, r *authn.Request, err error) {
	if err != nil {
		return
	}

	deviceID := r.HTTPRequest.Header.Get(deviceIDHeader)
	if deviceID == "" {
		return
	}

	errD := a.anonStore.DeleteDevice(ctx, deviceID)
	if errD != nil {
		a.log.Debug("Failed to untag device", "error", errD)
	}
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

	err = a.tagDeviceUI(ctx, taggedDevice)
	if err != nil {
		a.log.Debug("Failed to tag device for UI", "error", err)
		return err
	}

	return nil
}

// ListDevices returns all devices that have been updated between the given times.
func (a *AnonDeviceService) ListDevices(ctx context.Context, from *time.Time, to *time.Time) ([]*anonstore.Device, error) {
	if !a.cfg.Anonymous.Enabled {
		a.log.Debug("Anonymous access is disabled, returning empty result")
		return []*anonstore.Device{}, nil
	}

	return a.anonStore.ListDevices(ctx, from, to)
}

// CountDevices returns the number of devices that have been updated between the given times.
func (a *AnonDeviceService) CountDevices(ctx context.Context, from time.Time, to time.Time) (int64, error) {
	if !a.cfg.Anonymous.Enabled {
		a.log.Debug("Anonymous access is disabled, returning empty result")
		return 0, nil
	}

	return a.anonStore.CountDevices(ctx, from, to)
}

func (a *AnonDeviceService) SearchDevices(ctx context.Context, query *anonstore.SearchDeviceQuery) (*anonstore.SearchDeviceQueryResult, error) {
	if !a.cfg.Anonymous.Enabled {
		a.log.Debug("Anonymous access is disabled, returning empty result")
		return nil, nil
	}
	return a.anonStore.SearchDevices(ctx, query)
}

func (a *AnonDeviceService) Run(ctx context.Context) error {
	ticker := time.NewTicker(2 * time.Hour)

	for {
		select {
		case <-ticker.C:
			err := a.serverLock.LockAndExecute(ctx, "cleanup old anon devices", time.Hour*10, func(context.Context) {
				if err := a.anonStore.DeleteDevicesOlderThan(ctx, time.Now().Add(-keepFor)); err != nil {
					a.log.Error("An error occurred while deleting old anon devices", "err", err)
				}
			})
			if err != nil {
				a.log.Error("Failed to lock and execute cleanup old anon devices", "error", err)
			}

		case <-ctx.Done():
			return ctx.Err()
		}
	}
}
