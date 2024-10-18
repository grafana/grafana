type CrashDetectionOptions<CustomProperties> = {
  id: string;
  reportCrash: (crashedTab: CustomProperties) => Promise<boolean>;
  updateInfo: (currentTab: CustomProperties) => void;
  createDetectorWorker: () => SharedWorker;
  createClientWorker: () => Worker;
};

export default function initCrashDetection<CustomProperties extends object = {}>(
  options: CrashDetectionOptions<CustomProperties>
) {
  let worker;
  let detector;
  let info = {};

  async function reportCrash(event) {
    if (event.data.event === 'crash-detected' && event.data.reporter.id === info.id) {
      const tab = event.data.tab;
      const success = await options.reportCrash(tab);
      if (success) {
        detector.port.postMessage({ event: 'crash-reported', id: event.data.tab.id });
      }
    }
  }

  /**
   * Generate id for the tab
   */
  function initialize() {
    info.id = options.id;
  }

  /**
   * Update latest state of the tab
   */
  function updateInfo() {
    options.updateInfo(info);
    worker.postMessage({
      event: 'update',
      info,
    });
  }

  function registerWorker() {
    worker = options.createClientWorker();
    worker.addEventListener('message', updateInfo);
    detector = options.createDetectorWorker();
    detector.port.addEventListener('message', reportCrash);
    detector.port.start();
  }

  async function start() {
    initialize();

    registerWorker();

    window.onbeforeunload = function () {
      worker.postMessage({
        event: 'close',
        info,
      });
    };

    worker.postMessage({
      event: 'start',
      info,
    });
  }

  window.addEventListener('load', start);
}
