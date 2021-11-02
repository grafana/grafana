import { __awaiter, __generator } from "tslib";
import { LiveChannelScope } from '@grafana/data';
import { grafanaLiveCoreFeatures, GrafanaLiveDataSourceScope, GrafanaLivePluginScope, GrafanaLiveStreamScope, } from './scope';
var GrafanaLiveChannelConfigService = /** @class */ (function () {
    function GrafanaLiveChannelConfigService() {
        var _a;
        var _this = this;
        this.getScope = function (liveChannelScope) {
            return _this.scopes[liveChannelScope];
        };
        this.doesScopeExist = function (liveChannelScope) {
            return Boolean(_this.scopes[liveChannelScope]);
        };
        this.getChannelSupport = function (liveChannelScope, namespace) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, this.getScope(liveChannelScope).getChannelSupport(namespace)];
        }); }); };
        this.getNamespaces = function (liveChannelScope) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, this.getScope(liveChannelScope).listNamespaces()];
        }); }); };
        this.scopes = Object.freeze((_a = {},
            _a[LiveChannelScope.Grafana] = grafanaLiveCoreFeatures,
            _a[LiveChannelScope.DataSource] = new GrafanaLiveDataSourceScope(),
            _a[LiveChannelScope.Plugin] = new GrafanaLivePluginScope(),
            _a[LiveChannelScope.Stream] = new GrafanaLiveStreamScope(),
            _a));
    }
    return GrafanaLiveChannelConfigService;
}());
export { GrafanaLiveChannelConfigService };
//# sourceMappingURL=index.js.map