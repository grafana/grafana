var _a, _b, _c;
import { config, getBackendSrv, getGrafanaLiveSrv, setGrafanaLiveSrv } from '@grafana/runtime';
import { CentrifugeSrv } from './centrifuge/service';
import { registerLiveFeatures } from './features';
import { GrafanaLiveService } from './live';
import { GrafanaLiveChannelConfigService } from './channel-config';
import { contextSrv } from '../../core/services/context_srv';
var grafanaLiveScopesSingleton = new GrafanaLiveChannelConfigService();
export var getGrafanaLiveScopes = function () { return grafanaLiveScopesSingleton; };
export var sessionId = ((_c = (_b = (_a = window) === null || _a === void 0 ? void 0 : _a.grafanaBootData) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.id) +
    '/' +
    Date.now().toString(16) +
    '/' +
    Math.random().toString(36).substring(2, 15);
export function initGrafanaLive() {
    var centrifugeSrv = new CentrifugeSrv({
        appUrl: "" + window.location.origin + config.appSubUrl,
        orgId: contextSrv.user.orgId,
        orgRole: contextSrv.user.orgRole,
        liveEnabled: config.liveEnabled,
        sessionId: sessionId,
    });
    setGrafanaLiveSrv(new GrafanaLiveService({
        scopes: getGrafanaLiveScopes(),
        centrifugeSrv: centrifugeSrv,
        backendSrv: getBackendSrv(),
    }));
    registerLiveFeatures();
}
export function getGrafanaLiveCentrifugeSrv() {
    return getGrafanaLiveSrv();
}
//# sourceMappingURL=index.js.map