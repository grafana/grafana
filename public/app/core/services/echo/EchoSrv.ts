import { faro } from '@grafana/faro-web-sdk';
import { getEchoSrv, EchoEventType } from '@grafana/runtime';

import { PerformanceEvent } from './backends/PerformanceBackend';

export const reportPerformance = (metric: string, value: number) => {
  getEchoSrv().addEvent<PerformanceEvent>({
    type: EchoEventType.Performance,
    payload: {
      name: metric,
      value: value,
    },
  });
};

// Farp will process the error, then push it to EchoSrv as GrafanaJavascriptAgent event
export const reportError = (error: Error) => faro?.api?.pushError(error);
