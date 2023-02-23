import prom  from 'prom-client'
import Fastify from 'fastify';
const fastify = Fastify({ logger: true });

// Counter
const counter = new prom.Counter({
  name: 'metric_counter',
  help: 'metric_counter_help',
});

// Gauge
const gauge = new prom.Gauge({
  name: 'metric_gauge',
  help: 'metric_gauge_help',
});
gauge.set(10); // Set to 10
gauge.inc(); // Increment 1
gauge.inc(10); // Increment 10
gauge.dec(); // Decrement by 1
gauge.dec(10); // Decrement by 10

// Histogram
const histogram = new prom.Histogram({
  name: 'metric_histogram',
  help: 'metric_histogram_help',
  buckets: [0.1, 5, 15, 50, 100, 500],
});

// Summary
const summary = new prom.Summary({
  name: 'metric_summary',
  help: 'metric_summary_help',
});

let tickCounter = 0;

(function tickRunner() {
  if (tickCounter === 100) tickCounter = 1;
  else tickCounter++;
  tick();
  setTimeout(tickRunner, 1000);
})();

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function tick() {
  counter.inc(3);
  gauge.inc(getRandomInt(25));
  gauge.dec(getRandomInt(25));
  histogram.observe(getRandomInt(500));
  summary.observe(getRandomInt(500));
}

fastify.get('/metrics', async (request, reply) => {
  return prom.register.metrics()
});

fastify.listen(8000, '0.0.0.0', error => {
  if (error) {
    process.exit(1);
  }
});