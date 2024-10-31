import { initDetectorWorker } from 'crashme';

initDetectorWorker({
  dbName: 'grafana.crashes',
  staleThreshold: 60000,
  interval: 5000,
  crashThreshold: 5000,
});
