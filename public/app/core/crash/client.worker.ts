import { initClientWorker } from 'crashme';

initClientWorker({
  dbName: 'grafana.crashes',
  // How often the tab will report its state
  pingInterval: 1000,
});
