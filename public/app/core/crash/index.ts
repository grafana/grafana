// @ts-nocheck
import { initCrashDetection } from 'crashme';
import { nanoid } from 'nanoid';

import { config, createMonitoringLogger } from '@grafana/runtime';

import { contextSrv } from '../services/context_srv';

import { prepareContext } from './crash.utils';

const logger = createMonitoringLogger('core.crash-detection');

export function initializeCrashDetection() {
  initCrashDetection({
    id: nanoid(5),

    dbName: 'grafana.crashes',

    createClientWorker(): Worker {
      return new Worker(new URL('./client.worker', import.meta.url));
    },

    createDetectorWorker(): SharedWorker {
      return new SharedWorker(new URL('./detector.worker', import.meta.url));
    },

    reportCrash: async (tab) => {
      const preparedContext = prepareContext(tab);
      logger.logWarning('browser crash detected', preparedContext);
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

      if (performance?.memory?.usedJSHeapSize) {
        info.memory = {
          heapUtilization: performance?.memory?.usedJSHeapSize / performance?.memory?.totalJSHeapSize,
          limitUtilization: performance?.memory?.totalJSHeapSize / performance?.memory?.jsHeapSizeLimit,
          usedJSHeapSize: performance?.memory?.usedJSHeapSize,
          totalJSHeapSize: performance?.memory?.totalJSHeapSize,
          jsHeapSizeLimit: performance?.memory?.jsHeapSizeLimit,
        };
      }
    },
  });
}
