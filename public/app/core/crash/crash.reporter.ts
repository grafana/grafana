// @ts-nocheck
import { nanoid } from 'nanoid';

import { config, createMonitoringLogger } from '@grafana/runtime';

import { contextSrv } from '../services/context_srv';
import initCrashDetection from '../utils/crashdetection/client-controller';

const logger = createMonitoringLogger('core.crash-detection');

/**
 * Ensures the context is a flat object with strings
 */
function prepareContext(context: Object): Record<string, string> {
  const preparedContext = {};
  function prepare(value, propertyName) {
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        throw new Error('Array values are not supported.');
      } else {
        for (const key in value) {
          if (value.hasOwnProperty(key)) {
            prepare(value[key], propertyName ? `${propertyName}_${key}` : key);
          }
        }
      }
    } else if (typeof value === 'string') {
      preparedContext[propertyName] = value;
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        preparedContext[propertyName] = value.toString();
      } else {
        preparedContext[propertyName] = value.toFixed(4);
      }
    }
  }
  prepare(context, 'context');
  return preparedContext;
}

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
      const preparedContext = prepareContext(tab);
      logger.logInfo('browser crash detected', preparedContext);
      console.log('browser crash detected, context', preparedContext);
      console.log('browser crash detected', tab);
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
