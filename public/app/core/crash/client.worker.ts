import { initClientWorker } from '../utils/crashdetection/client-worker';

initClientWorker({
  dbName: 'grafana.crashes',
  pingInterval: 1000,
});
