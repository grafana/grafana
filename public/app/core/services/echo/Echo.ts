import { EchoBackend, EchoMeta, EchoEvent, EchoSrv } from '@grafana/runtime';
import { contextSrv } from '../context_srv';

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

  constructor(config?: Partial<EchoConfig>) {
    this.config = {
      ...this.config,
      ...config,
    };
    setInterval(this.flush, this.config.flushInterval);
  }

  logDebug = (...msg: any) => {
    if (this.config.debug) {
      // eslint-disable-next-line
      // console.debug('ECHO:', ...msg);
    }
  };

  flush = () => {
    for (const backend of this.backends) {
      backend.flush();
    }
  };

  addBackend = (backend: EchoBackend) => {
    this.logDebug('Adding backend', backend);
    this.backends.push(backend);
  };

  addEvent = <T extends EchoEvent>(event: Omit<T, 'meta'>, _meta?: {}) => {
    const meta = this.getMeta();
    const _event = {
      ...event,
      meta: {
        ...meta,
        ..._meta,
      },
    };

    for (const backend of this.backends) {
      if (backend.supportedEvents.length === 0 || backend.supportedEvents.indexOf(_event.type) > -1) {
        backend.addEvent(_event);
      }
    }

    this.logDebug('Adding event', _event);
  };

  getMeta = (): EchoMeta => {
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
}
