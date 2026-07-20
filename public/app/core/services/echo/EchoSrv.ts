import { getEchoSrv, EchoEventType } from '@grafana/runtime';

import { type PerformanceEvent } from './backends/PerformanceBackend';

export const reportPerformance = (metric: string, value: number) => {
  getEchoSrv().addEvent<PerformanceEvent>({
    type: EchoEventType.Performance,
    payload: {
      name: metric,
      value: value,
    },
  });
};
