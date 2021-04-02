let lastUpdate = Date.now();

if (!(window as any).grafanaStreamingPerfBudget) {
  (window as any).grafanaStreamingPerfBudget = 1.05;
}

/**
 * This object indicats how overloaded the main thread is
 */
export const perf = {
  budget: 1,
  ok: true,
  last: lastUpdate,
};

// target is 20hz (50ms), but we poll at 100ms to smooth out jitter
const interval = 100;

function measure() {
  const now = Date.now();
  perf.last = now;
  perf.budget = (now - lastUpdate) / interval;
  perf.ok = perf.budget <= (window as any).grafanaStreamingPerfBudget;
  lastUpdate = now;
}

setInterval(measure, interval);
