import app from './app';
// @ts-ignore
import ttiPolyfill from 'tti-polyfill';

import { getPerformanceBackend } from './core/services/echo/backends/PerformanceBackend';
import { setEchoMeta, reportPerformance, registerEchoBackend } from './core/services/echo/EchoSrv';

ttiPolyfill.getFirstConsistentlyInteractive().then((tti: any) => {
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

registerEchoBackend(getPerformanceBackend({}));

window.addEventListener('DOMContentLoaded', () => {
  reportPerformance('dcl', Math.round(performance.now()));
});

app.init();
