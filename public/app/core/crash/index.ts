import { initCrashDetection } from 'crashme';
import { BaseStateReport } from 'crashme/dist/types';
import { nanoid } from 'nanoid';

import { config, createMonitoringLogger } from '@grafana/runtime';

import { contextSrv } from '../services/context_srv';

import { isChromePerformance, prepareContext } from './crash.utils';

const logger = createMonitoringLogger('core.crash-detection');

interface GrafanaCrashReport extends BaseStateReport {
  app: {
    version: string;
    url: string;
  };
  user: {
    email: string;
    login: string;
    name: string;
  };
  memory?: {
    heapUtilization: number;
    limitUtilization: number;
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export function initializeCrashDetection() {
  initCrashDetection<GrafanaCrashReport>({
    id: nanoid(5),

    dbName: 'grafana.crashes',

    createClientWorker(): Worker {
      return new Worker(new URL('./client.worker', import.meta.url));
    },

    createDetectorWorker(): SharedWorker {
      return new SharedWorker(new URL('./detector.worker', import.meta.url));
    },

    reportCrash: async (report) => {
      const preparedContext = prepareContext(report);
      logger.logWarning('browser crash detected', preparedContext);
      return true;
    },

    reportStaleTab: async (report) => {
      const preparedContext = prepareContext(report);
      logger.logWarning('stale browser tab detected', preparedContext);
      return true;
    },

    updateInfo: (info) => {
      info.app = {
        version: config.buildInfo.version,
        url: window.location.href,
      };

      info.user = {
        email: contextSrv.user.email,
        login: contextSrv.user.login,
        name: contextSrv.user.name,
      };

      if (isChromePerformance(performance)) {
        info.memory = {
          heapUtilization: performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize,
          limitUtilization: performance.memory.totalJSHeapSize / performance.memory.jsHeapSizeLimit,
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        };
      }
    },
  });
}
