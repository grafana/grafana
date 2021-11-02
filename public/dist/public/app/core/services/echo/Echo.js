import { __assign, __values } from "tslib";
import { contextSrv } from '../context_srv';
import { echoLog } from './utils';
/**
 * Echo is a service for collecting events from Grafana client-app
 * It collects events, distributes them across registered backend and flushes once per configured interval
 * It's up to the registered backend to decide what to do with a given type of metric
 */
var Echo = /** @class */ (function () {
    // meta data added to every event collected
    function Echo(config) {
        var _this = this;
        this.config = {
            flushInterval: 10000,
            debug: false,
        };
        this.backends = [];
        this.flush = function () {
            var e_1, _a;
            try {
                for (var _b = __values(_this.backends), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var backend = _c.value;
                    backend.flush();
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        };
        this.addBackend = function (backend) {
            echoLog('Adding backend', false, backend);
            _this.backends.push(backend);
        };
        this.addEvent = function (event, _meta) {
            var e_2, _a;
            var meta = _this.getMeta();
            var _event = __assign(__assign({}, event), { meta: __assign(__assign({}, meta), _meta) });
            try {
                for (var _b = __values(_this.backends), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var backend = _c.value;
                    if (backend.supportedEvents.length === 0 || backend.supportedEvents.indexOf(_event.type) > -1) {
                        backend.addEvent(_event);
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
            echoLog('Reporting event', false, _event);
        };
        this.getMeta = function () {
            return {
                sessionId: '',
                userId: contextSrv.user.id,
                userLogin: contextSrv.user.login,
                userSignedIn: contextSrv.user.isSignedIn,
                screenSize: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                },
                windowSize: {
                    width: window.screen.width,
                    height: window.screen.height,
                },
                userAgent: window.navigator.userAgent,
                ts: new Date().getTime(),
                timeSinceNavigationStart: performance.now(),
                url: window.location.href,
            };
        };
        this.config = __assign(__assign({}, this.config), config);
        setInterval(this.flush, this.config.flushInterval);
    }
    return Echo;
}());
export { Echo };
//# sourceMappingURL=Echo.js.map