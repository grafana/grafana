import { EchoBackend, EchoEvent, EchoEventType, PageviewEchoEvent } from '@grafana/runtime';

interface BrowserConsoleBackendOptions {}

const colors: Record<string, string | undefined> = {
  Pageview: '#3498db',
  Interaction: '#b07cc6',
  MetaAnalytics: '#a66bbe',
  Performance: '#e67e22',
};

export class BrowserConsoleBackend implements EchoBackend<PageviewEchoEvent, BrowserConsoleBackendOptions> {
  // Empty array supports all events
  supportedEvents = [];

  constructor(public options: BrowserConsoleBackendOptions) {}

  logEvent(eventType: string, ...properties: unknown[]) {
    const color = colors[eventType];
    let labelCss = 'font-weight: bold;';

    if (color) {
      labelCss += `color: ${color}`;
    }

    console.log(`%c[${eventType}]`, labelCss, ...properties);
  }

  addEvent = (e: EchoEvent<EchoEventType, any>) => {
    switch (e.type) {
      case EchoEventType.Pageview: {
        return this.logEvent('Pageview', e.payload.page);
      }

      case EchoEventType.Interaction: {
        return this.logEvent('Interaction', e.payload.interactionName, e.payload.properties);
      }

      case EchoEventType.ExperimentView: {
        return this.logEvent('Experiment', e.payload);
      }

      case EchoEventType.Performance: {
        return this.logEvent('Performance', e.payload);
      }

      case EchoEventType.MetaAnalytics: {
        return this.logEvent('MetaAnalytics', e.payload);
      }

      case EchoEventType.Sentry: {
        return this.logEvent('Sentry', e.payload);
      }

      case EchoEventType.GrafanaJavascriptAgent: {
        return this.logEvent('GrafanaJavascriptAgent', e.payload);
      }
    }

    // If the following line has a type error like "e.type is not assignable to parameter of type 'never'"
    // then it's probably because a new EchoEventType has been added and the above switch is not exhaustive
    assertNever(e.type);
  };

  // Not using Echo buffering, addEvent above sends events to GA as soon as they appear
  flush = () => {};
}

function assertNever(foo: never): never {
  throw new Error('Unhandled event type in DevConsoleBackend');
}
