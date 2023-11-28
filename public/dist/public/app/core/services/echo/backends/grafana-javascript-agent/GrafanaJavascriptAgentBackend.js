import { initializeFaro, defaultMetas, ErrorsInstrumentation, ConsoleInstrumentation, WebVitalsInstrumentation, FetchTransport, } from '@grafana/faro-web-sdk';
import { EchoEventType } from '@grafana/runtime';
import { EchoSrvTransport } from './EchoSrvTransport';
export class GrafanaJavascriptAgentBackend {
    constructor(options) {
        this.options = options;
        this.supportedEvents = [EchoEventType.GrafanaJavascriptAgent];
        this.addEvent = (e) => {
            this.transports.forEach((t) => t.send(e.payload));
        };
        // backend will log events to stdout, and at least in case of hosted grafana they will be
        // ingested into Loki. Due to Loki limitations logs cannot be backdated,
        // so not using buffering for this backend to make sure that events are logged as close
        // to their context as possible
        this.flush = () => { };
        // configure instrumentalizations
        const instrumentations = [];
        this.transports = [];
        if (options.customEndpoint) {
            this.transports.push(new FetchTransport({ url: options.customEndpoint, apiKey: options.apiKey }));
        }
        if (options.errorInstrumentalizationEnabled) {
            instrumentations.push(new ErrorsInstrumentation());
        }
        if (options.consoleInstrumentalizationEnabled) {
            instrumentations.push(new ConsoleInstrumentation());
        }
        if (options.webVitalsInstrumentalizationEnabled) {
            instrumentations.push(new WebVitalsInstrumentation());
        }
        // initialize GrafanaJavascriptAgent so it can set up its hooks and start collecting errors
        const grafanaJavaScriptAgentOptions = {
            globalObjectKey: options.globalObjectKey || 'faro',
            preventGlobalExposure: options.preventGlobalExposure || false,
            app: {
                version: options.buildInfo.version,
                environment: options.buildInfo.env,
            },
            instrumentations,
            transports: [new EchoSrvTransport()],
            ignoreErrors: [
                'ResizeObserver loop limit exceeded',
                'ResizeObserver loop completed',
                'Non-Error exception captured with keys',
            ],
            metas: [
                ...defaultMetas,
                {
                    session: {
                        // new session id for every page load
                        id: (Math.random() + 1).toString(36).substring(2),
                    },
                },
            ],
        };
        this.faroInstance = initializeFaro(grafanaJavaScriptAgentOptions);
        if (options.user) {
            this.faroInstance.api.setUser({
                id: options.user.id,
                attributes: {
                    orgId: String(options.user.orgId) || '',
                },
            });
        }
    }
}
//# sourceMappingURL=GrafanaJavascriptAgentBackend.js.map