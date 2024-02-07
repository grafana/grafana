// import { Dashboard } from '@grafana/schema';

import { getDashboardChanges } from './getDashboardChanges';

self.onmessage = (e: MessageEvent<{ initial: any; changed: any }>) => {
  const result = getDashboardChanges(e.data.initial, e.data.changed, true, true);
  //   blockMainThread();
  self.postMessage(result);
};

// function blockMainThread() {
//   console.log('Blocking main thread for 5 seconds... in worker');

//   // Simulate blocking the main thread for 2 seconds
//   const startTime = Date.now();
//   while (Date.now() - startTime < 5000) {
//     // Busy-waiting to simulate blocking
//   }

//   console.log('Main thread unblocked!');
// }

export {};
