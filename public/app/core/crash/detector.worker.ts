import { initDetectorWorker } from 'crashme';

initDetectorWorker({
  dbName: 'grafana.crashes',
  inactivityThreshold: 5000,
});
