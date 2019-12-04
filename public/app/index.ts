import app from './app';
// @ts-ignore
import ttiPolyfill from 'tti-polyfill';

import { PerformanceBackend } from './core/services/echo/backends/PerformanceBackend';
import { setEchoMeta, reportPerformance, registerEchoBackend } from './core/services/echo/EchoSrv';

ttiPolyfill.getFirstConsistentlyInteractive().then((tti: any) => {
  // Collecting paint metrics first
  const paintMetrics = performance.getEntriesByType('paint');

  for (const metric of paintMetrics) {
    reportPerformance(metric.name, Math.round(metric.startTime + metric.duration));
  }
  reportPerformance('tti', tti);
});

window.addEventListener('DOMContentLoaded', () => {
  reportPerformance('dcl', Math.round(performance.now()));
});

setEchoMeta({
  screenSize: {
    width: window.innerWidth,
    height: window.innerHeight,
  },
  windowSize: {
    width: window.screen.width,
    height: window.screen.height,
  },
  userAgent: window.navigator.userAgent,
  url: window.location.href,
});

registerEchoBackend(new PerformanceBackend({}));

app.init();
