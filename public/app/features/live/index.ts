import { GrafanaLiveSrv, config, getBackendSrv, getGrafanaLiveSrv, setGrafanaLiveSrv } from '@grafana/runtime';
import { liveTimer } from 'app/features/dashboard/dashgrid/liveTimer';

import { contextSrv } from '../../core/services/context_srv';
import { loadUrlToken } from '../../core/utils/urlToken';

import { CentrifugeService } from './centrifuge/service';
import { GrafanaLiveService } from './live';

export async function initGrafanaLive() {
  // Select the namespace based on backend capabilities
  // This can be removed after the slow RRC has been updated everywhere
  const info = await getBackendSrv().get('api/live/list');

  const centrifugeServiceDeps = {
    appUrl: `${window.location.origin}${config.appSubUrl}`,
    namespace: info.namespaced ? config.namespace : `${contextSrv.user.orgId}`,
    orgRole: contextSrv.user.orgRole,
    liveEnabled: config.liveEnabled,
    dataStreamSubscriberReadiness: liveTimer.ok.asObservable(),
    grafanaAuthToken: loadUrlToken(),
  };

  const centrifugeSrv = new CentrifugeService(centrifugeServiceDeps);

  setGrafanaLiveSrv(
    new GrafanaLiveService({
      centrifugeSrv,
      backendSrv: getBackendSrv(),
    })
  );
}

export function getGrafanaLiveCentrifugeSrv(): GrafanaLiveSrv {
  return getGrafanaLiveSrv();
}
