import { getEchoSrv, EchoEventType, config, locationService } from '@grafana/runtime';
import { captureException } from '@sentry/browser';
import { PerformanceEvent } from './backends/PerformanceBackend';
import { PageviewEchoEvent } from './backends/analytics/types';

export const reportPerformance = (metric: string, value: number) => {
  getEchoSrv().addEvent<PerformanceEvent>({
    type: EchoEventType.Performance,
    payload: {
      name: metric,
      value: value,
    },
  });
};

// Sentry will process the error, adding it's own metadata, applying any sampling rules,
// then push it to EchoSrv as SentryEvent
export const reportError = (error: Error) => captureException(error);

export const reportPageview = () => {
  const location = locationService.getLocation();
  const page = `${config.appSubUrl ?? ''}${location.pathname}${location.search}${location.hash}`;
  getEchoSrv().addEvent<PageviewEchoEvent>({
    type: EchoEventType.Pageview,
    payload: {
      page,
    },
  });
};
