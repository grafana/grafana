import { config } from '../config';
import { locationService } from '../services';
import { getEchoSrv, EchoEventType } from '../services/EchoSrv';

import {
  type ExperimentViewEchoEvent,
  type InteractionEchoEvent,
  type MetaAnalyticsEvent,
  type MetaAnalyticsEventPayload,
  type PageviewEchoEvent,
  type ResourceViewEchoEvent,
  type ResourceViewEchoEventPayload,
} from './types';

/**
 * Helper function to report meta analytics to the {@link EchoSrv}.
 *
 * @public
 */
export const reportMetaAnalytics = (payload: MetaAnalyticsEventPayload) => {
  getEchoSrv().addEvent<MetaAnalyticsEvent>({
    type: EchoEventType.MetaAnalytics,
    payload,
  });
};

export const MAX_PAGE_URL_LENGTH = 2048;
export const TRUNCATION_MARKER = '[url too long]';

/**
 * Helper function to report pageview events to the {@link EchoSrv}.
 *
 * @public
 */
export const reportPageview = () => {
  const location = locationService.getLocation();
  const fullPage = `${config.appSubUrl ?? ''}${location.pathname}${location.search}${location.hash}`;
  const page =
    fullPage.length > MAX_PAGE_URL_LENGTH
      ? `${fullPage.substring(0, MAX_PAGE_URL_LENGTH - TRUNCATION_MARKER.length)}${TRUNCATION_MARKER}`
      : fullPage;
  getEchoSrv().addEvent<PageviewEchoEvent>({
    type: EchoEventType.Pageview,
    payload: {
      page,
    },
  });
};

/**
 * Helper function to report interaction events to the {@link EchoSrv}.
 *
 * @param options.silent - If true, the event is dispatched to EchoSrv subscribers
 * but not forwarded to analytics backends. Use for high-frequency UI signals
 * that downstream subscribers care about but shouldn't pollute the analytics stream.
 *
 * @public
 */
export const reportInteraction = (
  interactionName: string,
  properties?: Record<string, unknown>,
  options?: { silent?: boolean }
) => {
  // get static reporting context and append it to properties
  if (config.reportingStaticContext && config.reportingStaticContext instanceof Object) {
    properties = { ...properties, ...config.reportingStaticContext };
  }
  getEchoSrv().addEvent<InteractionEchoEvent>({
    type: EchoEventType.Interaction,
    payload: {
      interactionName,
      properties,
      silent: options?.silent,
    },
  });
};

/**
 * Helper function to report experimentview events to the {@link EchoSrv}.
 *
 * @public
 */
export const reportExperimentView = (id: string, group: string, variant: string) => {
  getEchoSrv().addEvent<ExperimentViewEchoEvent>({
    type: EchoEventType.ExperimentView,
    payload: {
      experimentId: id,
      experimentGroup: group,
      experimentVariant: variant,
    },
  });
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Helper function to report that a resource of an opted-in kind was
 * viewed/started, to the {@link EchoSrv}, via the generic
 * {@link EchoEventType.ResourceView} event. Any kind's own frontend code can
 * call this; it never throws, and does nothing if any field is missing, not
 * a string, or empty. {@link getEchoSrv} itself never throws when no Echo
 * service has been set (it buffers into a FakeEchoSrv), so this needs no
 * extra guard for that case.
 *
 * @public
 */
export const reportResourceView = (payload: ResourceViewEchoEventPayload) => {
  if (payload === null || payload === undefined || typeof payload !== 'object') {
    return;
  }
  const { group, resource, name } = payload;
  if (!isNonEmptyString(group) || !isNonEmptyString(resource) || !isNonEmptyString(name)) {
    return;
  }
  getEchoSrv().addEvent<ResourceViewEchoEvent>({
    type: EchoEventType.ResourceView,
    payload: { group, resource, name },
  });
};

/**
 * Subscribe to a named interaction event. Fires synchronously every time
 * {@link reportInteraction} is called with a matching name.
 *
 * @returns unsubscribe function
 * @public
 */
export const onInteraction = (name: string, callback: (properties: Record<string, unknown>) => void): (() => void) => {
  return getEchoSrv().onInteraction(name, callback);
};
