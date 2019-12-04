import { EchoSrv, EchoMeta, EchoEventType, EchoBackend } from './types';
import { PerformanceEvent } from './backends/PerformanceBackend';
import { Echo } from './Echo';

let instance: EchoSrv;

export const getEcho = () => {
  if (!instance) {
    instance = new Echo({ debug: process.env.NODE_ENV === 'development' });

    // Attaching Echo to window object to enable debug
    // @ts-ignore
    window.Echo = instance;
  }
  return instance;
};

export const registerEchoBackend = (backend: EchoBackend) => {
  getEcho().addBackend(backend);
};

export const setEchoMeta = (meta: EchoMeta) => {
  getEcho().setMeta(meta);
};

export const reportPerformance = (metric: string, value: number) => {
  getEcho().addEvent<PerformanceEvent>({
    type: EchoEventType.Performance,
    payload: {
      metricName: metric,
      duration: value,
    },
  });
};
