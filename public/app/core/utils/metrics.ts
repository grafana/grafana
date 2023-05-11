import { reportPerformance } from '../services/echo/EchoSrv';

export function startMeasure(eventName: string) {
  if (!performance) {
    return;
  }

  try {
    performance.mark(`${eventName}_started`);
  } catch (error) {
    console.error(`[Metrics] Failed to startMeasure ${eventName}`, error);
  }
}

export function stopMeasure(eventName: string) {
  if (!performance) {
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
  } catch (error) {
    console.error(`[Metrics] Failed to stopMeasure ${eventName}`, error);
  }
}
