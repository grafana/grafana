import { reportPerformance } from '../services/echo/EchoSrv';

export function startMeasure(eventName: string) {
  if (!performance || !performance.mark) {
    return;
  }

  try {
    performance.mark(`${eventName}_started`);
  } catch (error) {
    console.error(`[Metrics] Failed to startMeasure ${eventName}`, error);
  }
}

export function stopMeasure(eventName: string) {
  if (!performance || !performance.mark) {
    return;
  }

  try {
    const started = `${eventName}_started`;
    const completed = `${eventName}_completed`;
    const measured = `${eventName}_measured`;

    performance.mark(completed);
    const measure = performance.measure(measured, started, completed);
    reportPerformance(`${eventName}_ms`, measure.duration);

    performance.clearMarks(started);
    performance.clearMarks(completed);
    performance.clearMeasures(measured);
    return measure;
  } catch (error) {
    console.error(`[Metrics] Failed to stopMeasure ${eventName}`, error);
    return;
  }
}

/**
 * Report when a metric of a given name was marked during the document lifecycle. Works for markers with no duration,
 * like PerformanceMark or PerformancePaintTiming (e.g. created with performance.mark, or first-contentful-paint)
 */
export function reportMetricPerformanceMark(metricName: string, prefix = '', suffix = ''): void {
  const metric = performance.getEntriesByName(metricName).at(0);
  if (metric) {
    const metricName = metric.name.replace(/-/g, '_');
    reportPerformance(`${prefix}${metricName}${suffix}`, Math.round(metric.startTime) / 1000);
  }
}
