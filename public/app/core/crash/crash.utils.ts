import { LogContext } from '@grafana/faro-core/dist/types/api/logs/types';

export interface ChromePerformanceMemory {
  totalJSHeapSize: number;
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface ChromePerformance {
  memory: ChromePerformanceMemory;
}

function isChromePerformanceMemory(memory: unknown): memory is ChromePerformanceMemory {
  if (!memory || typeof memory !== 'object') {
    return false;
  }

  return 'totalJSHeapSize' in memory && 'usedJSHeapSize' in memory && 'jsHeapSizeLimit' in memory;
}

export function isChromePerformance(performance: unknown): performance is ChromePerformance {
  if (!performance || typeof performance !== 'object') {
    return false;
  }

  return 'memory' in performance && isChromePerformanceMemory(performance.memory);
}

/**
 * Ensures the context is a flat object with strings (required by Faro)
 */
export function prepareContext(context: Object): LogContext {
  const preparedContext: LogContext = {};
  function prepare(value: object | string | number, propertyName: string) {
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        throw new Error('Array values are not supported.');
      } else {
        for (const key in value) {
          if (value.hasOwnProperty(key)) {
            // @ts-ignore
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
  prepare(context, 'crash');
  return preparedContext;
}
