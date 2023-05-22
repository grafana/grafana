import { config, getBackendSrv, getGrafanaLiveSrv, setGrafanaLiveSrv } from '@grafana/runtime';
import { liveTimer } from 'app/features/dashboard/dashgrid/liveTimer';

import { contextSrv } from '../../core/services/context_srv';
import { loadUrlToken } from '../../core/utils/urlToken';

import { CentrifugeService } from './centrifuge/service';
import { CentrifugeServiceWorkerProxy } from './centrifuge/serviceWorkerProxy';
import { GrafanaLiveService } from './live';

export function initGrafanaLive() {
  const centrifugeServiceDeps = {
    appUrl: `${window.location.origin}${config.appSubUrl}`,
    orgId: contextSrv.user.orgId,
    orgRole: contextSrv.user.orgRole,
    liveEnabled: config.liveEnabled,
    dataStreamSubscriberReadiness: liveTimer.ok.asObservable(),
    grafanaAuthToken: loadUrlToken(),
  };

  const centrifugeSrv = config.featureToggles['live-service-web-worker']
    ? new CentrifugeServiceWorkerProxy(centrifugeServiceDeps)
    : new CentrifugeService(centrifugeServiceDeps);

  setGrafanaLiveSrv(
    new GrafanaLiveService({
      centrifugeSrv,
      backendSrv: getBackendSrv(),
    })
  );
}

export function getGrafanaLiveCentrifugeSrv() {
  return getGrafanaLiveSrv() as GrafanaLiveService;
}
