export const perf = {
  fps: 0,
  ok: true,
};

let lastUpdate = Date.now();
function measure() {
  let now = Date.now();
  perf.fps = 1e3 / (now - lastUpdate);
  lastUpdate = now;
}
setInterval(measure, 50); // 20hz
