export function patchXMLHTTPRequest(
  beforeXHRSendCb: (url: string) => void,
  onRequestCompletedCb: (url: string) => void
) {
  const open = XMLHttpRequest.prototype.open;
  // const requestId = uniqueId++;

  // @ts-ignore
  XMLHttpRequest.prototype.open = function(...args) {
    // No arrow function.
    const url: string = args[1];
    beforeXHRSendCb(url);
    this.addEventListener('readystatechange', () => {
      // readyState 4 corresponds to 'DONE'
      if (this.readyState === 4) {
        onRequestCompletedCb(url);
      }
    });
    return open.apply(this, args);
  };
}

class RequestsMonitor {
  private queue: Record<string, Map<string, { startTs: number; endTs: number | null; duration: number | null }>> = {};
  private counters: Record<string, number> = {};
  private lastCompletedTs: Record<string, number> = {};

  push = (location: string, url: string, ts: number) => {
    if (!this.queue[location]) {
      this.queue[location] = new Map();
    }
    if (this.counters[location] === undefined) {
      this.counters[location] = 0;
    }
    this.counters[location]++;
    this.queue[location].set(url, {
      startTs: ts,
      endTs: null,
      duration: null,
    });
  };

  stopMonitoring = (location: string) => {
    this.queue[location] = null;
  };

  markComplete = (location: string, url: string) => {
    const endTs = performance.now();

    if (this.queue[location]) {
      const inFlight = this.queue[location].get(url);
      this.queue[location].set(url, {
        ...inFlight,
        endTs,
        duration: endTs - inFlight.startTs,
      });
      this.lastCompletedTs[location] = endTs;
      this.counters[location]--;
    }
  };

  hasInFlightRequests = (location: string) => {
    return this.counters[location] !== undefined && this.counters[location] !== 0;
  };

  getLastCompletedRequest = (location: string) => {
    return this.lastCompletedTs[location];
  };
}

export class NavigationMonitor {
  private currentLocation: string | null = null;
  private requestsMonitor: RequestsMonitor;
  private threshold = 500;
  private navigationInprogress = false;
  constructor() {
    this.requestsMonitor = new RequestsMonitor();

    patchXMLHTTPRequest(this.monitorRequest, this.stopMonitoringRequest);
  }

  monitorRequest = (url: string) => {
    this.requestsMonitor.push(this.currentLocation, url, performance.now());
  };

  validateFinishedNavigation = () => {
    const now = performance.now();

    if (!this.navigationInprogress) {
      return;
    }
    if (
      !this.requestsMonitor.hasInFlightRequests(this.currentLocation) &&
      now - this.requestsMonitor.getLastCompletedRequest(this.currentLocation) > this.threshold
    ) {
      this.stopMonitoringLocation(this.currentLocation);
      console.log('navigation finished...');
      // whenr eporting this metric -> substract the difference between perfomance.now and Requests monitor getLastCompletedRequest
      // to get more accurate result
    } else {
      requestAnimationFrame(this.validateFinishedNavigation);
    }
  };

  stopMonitoringRequest = (url: string) => {
    this.requestsMonitor.markComplete(this.currentLocation, url);
    requestAnimationFrame(this.validateFinishedNavigation);
  };

  startMonitoringLocation = (location: string) => {
    if (this.currentLocation && this.requestsMonitor.hasInFlightRequests(this.currentLocation)) {
      this.requestsMonitor.stopMonitoring(location);
      console.log('abandoned navigation');
    }
    this.currentLocation = location;
    this.navigationInprogress = true;
  };

  stopMonitoringLocation = (location: string) => {
    this.navigationInprogress = false;
    this.requestsMonitor.stopMonitoring(location);
    this.currentLocation = location;
  };
}
