// @ts-nocheck
import { nanoid } from 'nanoid';

import { config, createMonitoringLogger } from '@grafana/runtime';

import { contextSrv } from '../services/context_srv';
import initCrashDetection from '../utils/crashdetection/client-controller';

const logger = createMonitoringLogger('core.crash-detection');

export function startReportingCrashes() {
  initCrashDetection({
    id: nanoid(5),

    createClientWorker(): Worker {
      return new Worker(new URL('./client.worker', import.meta.url));
    },

    createDetectorWorker(): SharedWorker {
      return new SharedWorker(new URL('./detector.worker', import.meta.url));
    },

    reportCrash: async (tab) => {
      logger.logInfo('browser crash detected', tab);
      console.log('browser crash detected', tab);
      return true;
    },

    updateInfo: (info) => {
      info.url = window.location.href;
      info.config = {
        buildInfo: config.buildInfo,
        featureToggles: config.featureToggles,
      };
      info.user = contextSrv.user;
      info.memory = {
        usedJSHeapSize: performance?.memory?.usedJSHeapSize,
        totalJSHeapSize: performance?.memory?.totalJSHeapSize,
        jsHeapSizeLimit: performance?.memory?.jsHeapSizeLimit,
      };
    },
  });
}
