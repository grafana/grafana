import { config } from '../config';
import { locationService } from '../services';
import { getEchoSrv, EchoEventType } from '../services/EchoSrv';

import {
  type ExperimentViewEchoEvent,
  type InteractionEchoEvent,
  type MetaAnalyticsEvent,
  type MetaAnalyticsEventPayload,
  type PageviewEchoEvent,
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
 * @param options.silent - If true, the event fires onInteraction subscribers
 * but is not sent to analytics backends. Use for CUJ-internal signals that
 * don't need to be stored (e.g. command_palette_closed).
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

/**
 * Subscribe to a named interaction event. Fires synchronously every time
 * {@link reportInteraction} is called with a matching name.
 *
 * @returns unsubscribe function
 * @public
 */
export const onInteraction = (
  name: string,
  callback: (properties: Record<string, unknown>) => void
): (() => void) => {
  return getEchoSrv().onInteraction(name, callback);
};
