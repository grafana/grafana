import { config, getBackendSrv, getGrafanaLiveSrv, setGrafanaLiveSrv } from '@grafana/runtime';
import { registerLiveFeatures } from './features';
import { GrafanaLiveService } from './live';
import { GrafanaLiveChannelConfigService } from './channel-config';
import { GrafanaLiveChannelConfigSrv } from './channel-config/types';
import { contextSrv } from '../../core/services/context_srv';
import { CentrifugeServiceWorkerProxy } from './centrifuge/serviceWorkerProxy';
import { CentrifugeService } from './centrifuge/service';
import { liveTimer } from 'app/features/dashboard/dashgrid/liveTimer';

const grafanaLiveScopesSingleton = new GrafanaLiveChannelConfigService();

export const getGrafanaLiveScopes = (): GrafanaLiveChannelConfigSrv => grafanaLiveScopesSingleton;

export const sessionId =
  (window as any)?.grafanaBootData?.user?.id +
  '/' +
  Date.now().toString(16) +
  '/' +
  Math.random().toString(36).substring(2, 15);

export function initGrafanaLive() {
  const centrifugeServiceDeps = {
    appUrl: `${window.location.origin}${config.appSubUrl}`,
    orgId: contextSrv.user.orgId,
    orgRole: contextSrv.user.orgRole,
    liveEnabled: config.liveEnabled,
    sessionId,
    dataStreamSubscriberReadiness: liveTimer.ok.asObservable(),
  };

  const centrifugeSrv = config.featureToggles['live-service-web-worker']
    ? new CentrifugeServiceWorkerProxy(centrifugeServiceDeps)
    : new CentrifugeService(centrifugeServiceDeps);

  setGrafanaLiveSrv(
    new GrafanaLiveService({
      scopes: getGrafanaLiveScopes(),
      centrifugeSrv,
      backendSrv: getBackendSrv(),
    })
  );
  registerLiveFeatures();
}

export function getGrafanaLiveCentrifugeSrv() {
  return getGrafanaLiveSrv() as GrafanaLiveService;
}
