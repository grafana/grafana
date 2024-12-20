import { initDetectorWorker } from 'crashme';

initDetectorWorker({
  dbName: 'grafana.crashes',
  interval: 5000,
  crashThreshold: 5000,
  staleThreshold: 5000,
});
