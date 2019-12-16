import { getEchoSrv, EchoEventType } from '../services/EchoSrv';
import { MetaAnalyticsEvent, MetaAnalyticsEventPayload } from '../types/analytics';

export const reportMetaAnalytics = (payload: MetaAnalyticsEventPayload) => {
  getEchoSrv().addEvent<MetaAnalyticsEvent>({
    type: EchoEventType.MetaAnalytics,
    payload,
  });
};
