import {
  type EchoBackend,
  type EchoMeta,
  type EchoEvent,
  type EchoSrv,
  type InteractionEchoEventPayload,
  EchoEventType,
  MAX_PAGE_URL_LENGTH,
  TRUNCATION_MARKER,
} from '@grafana/runtime';

import { contextSrv } from '../context_srv';

import { echoLog } from './utils';

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
  // Per-interaction-name subscriber sets for CUJ journey tracking
  private interactionSubscribers = new Map<string, Set<(properties: Record<string, unknown>) => void>>();
  // meta data added to every event collected

  constructor(config?: Partial<EchoConfig>) {
    this.config = {
      ...this.config,
      ...config,
    };
    setInterval(this.flush, this.config.flushInterval);
  }

  flush = () => {
    for (const backend of this.backends) {
      backend.flush();
    }
  };

  addBackend = (backend: EchoBackend) => {
    echoLog('Adding backend', false, backend);
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

    // Dispatch to onInteraction subscribers first (used by CUJ journey tracking)
    // Subscribers always fire, even for silent events.
    if (event.type === EchoEventType.Interaction) {
      const payload: InteractionEchoEventPayload = event.payload;
      if (payload.interactionName) {
        const subscribers = this.interactionSubscribers.get(payload.interactionName);
        if (subscribers) {
          for (const cb of subscribers) {
            try {
              cb(payload.properties ?? {});
            } catch (err) {
              console.error(`[Echo] onInteraction subscriber error for "${payload.interactionName}":`, err);
            }
          }
        }
      }

      // Silent interactions skip backends and debug logging
      if (payload.silent) {
        return;
      }
    }

    for (const backend of this.backends) {
      if (backend.supportedEvents.length === 0 || backend.supportedEvents.indexOf(_event.type) > -1) {
        backend.addEvent(_event);
      }
    }

    echoLog(`${event.type} event`, false, {
      ...event.payload,
      meta: _event.meta,
    });
  };

  onInteraction = (name: string, callback: (properties: Record<string, unknown>) => void): (() => void) => {
    let subscribers = this.interactionSubscribers.get(name);
    if (!subscribers) {
      subscribers = new Set();
      this.interactionSubscribers.set(name, subscribers);
    }
    subscribers.add(callback);

    return () => {
      subscribers!.delete(callback);
      if (subscribers!.size === 0) {
        this.interactionSubscribers.delete(name);
      }
    };
  };

  getMeta = (): EchoMeta => {
    return {
      sessionId: '',
      userId: contextSrv.user.id,
      userLogin: contextSrv.user.login,
      userSignedIn: contextSrv.user.isSignedIn,
      orgRole: contextSrv.user.orgRole,
      orgId: contextSrv.user.orgId,
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
      url:
        window.location.href.length > MAX_PAGE_URL_LENGTH
          ? `${window.location.href.substring(0, MAX_PAGE_URL_LENGTH - TRUNCATION_MARKER.length)}${TRUNCATION_MARKER}`
          : window.location.href,
    };
  };
}
