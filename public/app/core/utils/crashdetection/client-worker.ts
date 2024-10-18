type ClientWorkerOptions = {
  pingInterval: number; // e.g. 1000
  dbName: string;
};

export function initClientWorker(options: ClientWorkerOptions) {
  let lastInfo;
  let tabLastActive = Date.now();
  let db;

  setInterval(() => {
    // ping to tab so it can send latest values
    postMessage({ event: 'ping' });

    if (!lastInfo?.id) {
      return;
    }

    const transaction = db.transaction(['tabs'], 'readwrite');
    const store = transaction.objectStore('tabs');

    const workerLastActive = Date.now();
    // save latest received info here - the tab may be paused because of debugging but we need to mark the tab as alive anyway because the worker is still alive
    lastInfo = { ...lastInfo, tabLastActive, workerLastActive };
    store.put(lastInfo);
  }, options.pingInterval);

  addEventListener('message', async (event) => {
    if (event.data.event === 'update') {
      tabLastActive = Date.now();
      lastInfo = { ...event.data.info };
    }
    if (event.data.event === 'start') {
      db = await getDb();
    }
    if (event.data.event === 'close') {
      const transaction = db.transaction(['tabs'], 'readwrite');
      const store = transaction.objectStore('tabs');
      store.delete(event.data.info.id);
    }
  });

  async function getDb() {
    return new Promise(function (resolve, reject) {
      let request = indexedDB.open(options.dbName);
      request.onerror = (event) => {
        reject(event.target.error);
      };
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('tabs')) {
          db.createObjectStore('tabs', { keyPath: 'id' });
        }
      };
    });
  }
}
