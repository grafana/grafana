import { getEchoSrv, EchoEventType } from '../services/EchoSrv';
import { MetaAnalyticsEvent, MetaAnalyticsEventPayload } from '../types/analytics';

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
