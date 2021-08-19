let lastUpdate = Date.now();

/**
 * This object indicats how overloaded the main thread is
 */
export const perf = {
  budget: 1,
  threshold: 1.5, // trial and error appears about right
  ok: true,
  last: lastUpdate,
};

// Expose this as a global object so it can be changed locally
// NOTE: when we are confident this is the right budget, this should be removed
(window as any).grafanaStreamingPerf = perf;

// target is 20hz (50ms), but we poll at 100ms to smooth out jitter
const interval = 100;

function measure() {
  const now = Date.now();
  perf.last = now;
  perf.budget = (now - lastUpdate) / interval;
  perf.ok = perf.budget <= perf.threshold;
  lastUpdate = now;
}

setInterval(measure, interval);
