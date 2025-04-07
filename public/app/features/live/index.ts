import { GrafanaLiveSrv, config, getBackendSrv, getGrafanaLiveSrv, setGrafanaLiveSrv } from '@grafana/runtime';
import { liveTimer } from 'app/features/dashboard/dashgrid/liveTimer';

import { contextSrv } from '../../core/services/context_srv';
import { loadUrlToken } from '../../core/utils/urlToken';

import { CentrifugeService } from './centrifuge/service';
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
