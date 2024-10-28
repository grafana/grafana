import { initClientWorker } from 'crashme';

initClientWorker({
  dbName: 'grafana.crashes',
  pingInterval: 1000,
});
