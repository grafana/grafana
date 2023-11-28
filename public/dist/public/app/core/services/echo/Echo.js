import { contextSrv } from '../context_srv';
import { echoLog } from './utils';
/**
 * Echo is a service for collecting events from Grafana client-app
 * It collects events, distributes them across registered backend and flushes once per configured interval
 * It's up to the registered backend to decide what to do with a given type of metric
 */
export class Echo {
    // meta data added to every event collected
    constructor(config) {
        this.config = {
            flushInterval: 10000,
            debug: false,
        };
        this.backends = [];
        this.flush = () => {
            for (const backend of this.backends) {
                backend.flush();
            }
        };
        this.addBackend = (backend) => {
            echoLog('Adding backend', false, backend);
            this.backends.push(backend);
        };
        this.addEvent = (event, _meta) => {
            const meta = this.getMeta();
            const _event = Object.assign(Object.assign({}, event), { meta: Object.assign(Object.assign({}, meta), _meta) });
            for (const backend of this.backends) {
                if (backend.supportedEvents.length === 0 || backend.supportedEvents.indexOf(_event.type) > -1) {
                    backend.addEvent(_event);
                }
            }
            echoLog(`${event.type} event`, false, Object.assign(Object.assign({}, event.payload), { meta: _event.meta }));
        };
        this.getMeta = () => {
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
                path: window.location.pathname,
                url: window.location.href,
            };
        };
        this.config = Object.assign(Object.assign({}, this.config), config);
        setInterval(this.flush, this.config.flushInterval);
    }
}
//# sourceMappingURL=Echo.js.map