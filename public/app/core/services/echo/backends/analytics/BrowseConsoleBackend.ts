/* eslint-disable no-console */
import {
  EchoBackend,
  EchoEventType,
  isExperimentViewEvent,
  isInteractionEvent,
  isPageviewEvent,
  PageviewEchoEvent,
} from '@grafana/runtime';

export class BrowserConsoleBackend implements EchoBackend<PageviewEchoEvent, unknown> {
  options = {};
  supportedEvents = [EchoEventType.Pageview, EchoEventType.Interaction, EchoEventType.ExperimentView];

  constructor() {
    console.log('[EchoSrv]', 'Registering BrowserConsoleBackend');
  }

  addEvent = (e: PageviewEchoEvent) => {
    if (isPageviewEvent(e)) {
      console.log('[EchoSrv:pageview]', e.payload.page);
    }

    if (isInteractionEvent(e)) {
      console.log('[EchoSrv:event]', e.payload.interactionName, e.payload.properties);
    }

    if (isExperimentViewEvent(e)) {
      console.log('[EchoSrv:experiment]', e.payload);
    }
  };

  flush = () => {};
}
