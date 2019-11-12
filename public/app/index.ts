import app from './app';
// @ts-ignore
import ttiPolyfill from 'tti-polyfill';

import { getPerformanceConsumer } from './core/services/echo/consumers/PerformanceConsumer';
import { setEchoMeta, reportPerformance, registerEchoConsumer } from './core/services/echo/EchoSrv';

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

// TODO: Pass url from env
registerEchoConsumer(getPerformanceConsumer({ url: 'http://localhost:8089' }));

window.addEventListener('DOMContentLoaded', () => {
  reportPerformance('dcl', Math.round(performance.now()));
});

app.init();
