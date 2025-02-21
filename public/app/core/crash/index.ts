import { initCrashDetection } from 'crashme';
import { BaseStateReport } from 'crashme/dist/types';
import { nanoid } from 'nanoid';

import { config, createMonitoringLogger } from '@grafana/runtime';
import { CorsWorker as Worker } from 'app/core/utils/CorsWorker';

import { contextSrv } from '../services/context_srv';
import { CorsSharedWorker as SharedWorker, sharedWorkersSupported } from '../utils/CorsSharedWorker';

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
    lastInteraction: number;
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
  if (!sharedWorkersSupported()) {
    return;
  }

  let lastInteraction = Date.now();
  // Add last interaction listeners to capture phase to reduce skipped events when stopPropagation() is called
  document.body.addEventListener('click', () => (lastInteraction = Date.now()), true);
  document.body.addEventListener('keypress', () => (lastInteraction = Date.now()), true);

  initCrashDetection<GrafanaCrashReport>({
    id: nanoid(5),

    dbName: 'grafana.crashes',

    createClientWorker(): Worker {
      return new Worker(new URL('./client.worker', import.meta.url));
    },

    /**
     *  There are limitations that require us to manually assert the type here.
     *  1) Webpack uses static code analysis to create a new entry point for a SharedWorker.
     *     It requies constructing an object with exact syntax new SharedWorker(...) (https://webpack.js.org/guides/web-workers/)
     *  2) Some browsers may not support SharedWorkers hence we cannot extend CorsSharedWorker like CorsWorker and
     *     window.SharedWorker needs to be referenced during runtime only if it is supported (https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker)
     *
     *  We guarantee the type assertion is correct by returning a SharedWorker in CorsSharedWorker constructor.
     */
    createDetectorWorker() {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return new SharedWorker(new URL('./detector.worker', import.meta.url)) as globalThis.SharedWorker;
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
        lastInteraction,
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
