let lastUpdate = Date.now();

export const perf = {
  budget: 1,
  now: lastUpdate,
  ok: true,
};

// target is 20hz (50ms), but we poll at 100ms to smooth out jitter
const it = 100;

function measure() {
  let now = Date.now();
  perf.now = now;
  perf.budget = (now - lastUpdate) / it;
  lastUpdate = now;
}

setInterval(measure, it); // 20hz
