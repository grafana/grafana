import app from './app';
// @ts-ignore
import ttiPolyfill from 'tti-polyfill';

import { setEchoSrv, setEchoMeta, registerEchoBackend } from '@grafana/runtime';
import { Echo } from './core/services/echo/Echo';
import { reportPerformance } from './core/services/echo/EchoSrv';
import { PerformanceBackend } from './core/services/echo/backends/PerformanceBackend';

setEchoSrv(new Echo({ debug: process.env.NODE_ENV === 'development' }));

ttiPolyfill.getFirstConsistentlyInteractive().then((tti: any) => {
  // Collecting paint metrics first
  const paintMetrics = performance.getEntriesByType('paint');

  for (const metric of paintMetrics) {
    reportPerformance(metric.name, Math.round(metric.startTime + metric.duration));
  }
  reportPerformance('tti', tti);
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

window.addEventListener('DOMContentLoaded', () => {
  reportPerformance('dcl', Math.round(performance.now()));
});

app.init();
