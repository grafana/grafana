import { initDetectorWorker } from '../utils/crashdetection/detector-worker';

initDetectorWorker({
  dbName: 'grafana.crashes',
  inactivityThreshold: 5000,
});
