import { EchoSrv, EchoMeta, EchoEventType, EchoConsumer } from './types';
import { PerformanceEvent } from './consumers/PerformanceConsumer';
import { Echo } from './Echo';

let instance: EchoSrv;

export const getEcho = () => {
  if (!instance) {
    instance = new Echo({ debug: process.env.NODE_ENV === 'development' });
    // @ts-ignore
    window.Echo = instance;
  }
  return instance;
};

export const registerEchoConsumer = (consumer: EchoConsumer) => {
  getEcho().addConsumer(consumer);
};

export const setEchoMeta = (meta: EchoMeta) => {
  getEcho().setMeta(meta);
};

export const reportPerformance = (metric: string, value: number) => {
  getEcho().consumeEvent<PerformanceEvent>({
    type: EchoEventType.Performance,
    payload: {
      metricName: metric,
      duration: value,
    },
  });
};
