import { EchoBackend, EchoMeta, EchoEvent, EchoSrv } from '@grafana/runtime';

interface EchoConfig {
  // How often should metrics be reported
  flushInterval: number;
  // Enables debug mode
  debug: boolean;
}

/**
 * Echo is a service for collecting events from Grafana client-app
 * It collects events, distributes them across registered backend and flushes once per configured interval
 * It's up to the registered backend to decide what to do with a given type of metric
 */
export class Echo implements EchoSrv {
  private config: EchoConfig = {
    flushInterval: 10000, // By default Echo flushes every 10s
    debug: false,
  };

  private backends: EchoBackend[] = [];
  // meta data added to every event collected
  private meta: EchoMeta;

  constructor(config?: Partial<EchoConfig>) {
    this.config = {
      ...this.config,
      ...config,
    };
    setInterval(this.flush, this.config.flushInterval);
  }

  logDebug = (...msg: any) => {
    if (this.config.debug) {
      // tslint:disable-next-line
      console.debug('ECHO:', ...msg);
    }
  };

  flush = () => {
    this.backends.forEach(c => {
      c.flush();
    });
  };

  addBackend = (backend: EchoBackend) => {
    this.logDebug('Adding backend', backend);
    this.backends.push(backend);
  };

  addEvent = <T extends EchoEvent>(event: Omit<T, 'meta' | 'ts'>, _meta?: {}) => {
    const meta = this.getMeta();
    const _event = {
      ...event,
      meta: {
        ...meta,
        ..._meta,
      },
      ts: performance.now(),
    };

    this.backends.forEach(backend => {
      if (!backend.supportedEvents || (backend.supportedEvents && backend.supportedEvents.indexOf(_event.type) > -1)) {
        backend.addEvent(_event);
      }
    });

    this.logDebug('Adding event', _event);
  };

  setMeta = (meta: Partial<EchoMeta>) => {
    this.logDebug('Setting meta', meta);
    this.meta = {
      ...this.meta,
      ...meta,
    };
  };

  getMeta = (): EchoMeta => {
    return {
      ...this.meta,
      url: window.location.href,
    };
  };
}
