import { config, getBackendSrv, setGrafanaLiveSrv } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { liveTimer } from 'app/features/dashboard/dashgrid/liveTimer';

import { contextSrv } from '../../core/services/context_srv';
import { loadUrlToken } from '../../core/utils/urlToken';

import { CentrifugeService } from './centrifuge/service';
import { GrafanaLiveService } from './live';

export function initGrafanaLive() {
  const centrifugeServiceDeps = {
    appUrl: `${window.location.origin}${config.appSubUrl}`,
    namespace: config.liveNamespaced ? config.namespace : `${contextSrv.user.orgId}`,
    orgRole: contextSrv.user.orgRole,
    liveEnabled: config.liveEnabled,
    websocketPath: getFeatureFlagClient().getBooleanValue(FlagKeys.LiveUseAPIServerWebsocket, false)
      ? `/apis/live.grafana.app/v1alpha1/namespaces/${config.namespace}/ws`
      : undefined,
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
