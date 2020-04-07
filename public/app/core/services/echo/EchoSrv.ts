import { getEchoSrv, EchoEventType } from '@grafana/runtime';
import { PerformanceEvent } from './backends/PerformanceBackend';

export const reportPerformance = (metric: string, value: number) => {
  getEchoSrv().addEvent<PerformanceEvent>({
    type: EchoEventType.Performance,
    payload: {
      metricName: metric,
      duration: value,
    },
  });
};
