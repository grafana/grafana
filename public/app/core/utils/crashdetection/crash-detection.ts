type DetectorWorkerOptions = {
  dbName: string;
  inactivityThreshold: number; // e.g. 5000
};

export function initDetectorWorker(options: DetectorWorkerOptions) {
  let db;
  let started = false;
  let clients = [];

  function crashReported(event) {
    if (event.data.event === 'crash-reported' && event.data.id) {
      const transaction = db.transaction(['tabs'], 'readwrite');
      const store = transaction.objectStore('tabs');
      store.delete(event.data.id);
    }
  }

  const INACTIVITY_THRESHOLD = options.inactivityThreshold;

  /**
   * Check which tabs have stopped sending updates but did not clear themselves properly
   */
  function checkStaleTabs() {
    const transaction = db.transaction(['tabs'], 'readwrite');
    const store = transaction.objectStore('tabs');
    const request = store.getAll();

    request.onsuccess = function () {
      const tabs = request.result;

      let activeTabs = [];
      let inactiveTabs = [];

      tabs.forEach(function (tab) {
        const workerInactivity = Date.now() - tab.workerLastActive;
        if (workerInactivity > INACTIVITY_THRESHOLD) {
          inactiveTabs.push(tab);
        } else {
          activeTabs.push(tab);
        }
      });

      if (activeTabs.length === 0) {
        // no active tabs, skip until a tab gets active
        return;
      }

      let candidate = activeTabs.pop();
      tabs.forEach(function (tab) {
        const workerInactivity = Date.now() - tab.workerLastActive;
        if (workerInactivity > INACTIVITY_THRESHOLD) {
          reportCrash(tab, candidate);
        }
      });
    };
  }

  function reportCrash(tab, reporter) {
    clients.forEach(function (port) {
      port.postMessage({ event: 'crash-detected', tab, reporter });
    });
  }

  self.onconnect = async function (event) {
    if (!started) {
      db = await getDb();

      const port = event.ports[0];
      clients.push(port);
      port.start();
      port.onmessage = crashReported;
      port.onclose = function () {
        clients = clients.filter((p) => p !== port);
      };

      setInterval(checkStaleTabs, INACTIVITY_THRESHOLD);
      started = true;
    }
  };

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
