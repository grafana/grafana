const http = require('http');

if (process.argv.length !== 3) {
  throw new Error('invalid command line: use node sendLogs.js LOKIC_BASE_URL');
}

const LOKI_BASE_URL = process.argv[2];

// helper function, do a http request
async function jsonRequest(data, method, url, expectedStatusCode) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        protocol: url.protocol,
        host: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
        headers: { 'content-type': 'application/json' },
      },
      (res) => {
        if (res.statusCode !== expectedStatusCode) {
          reject(new Error(`Invalid response: ${res.statusCode}`));
        } else {
          resolve();
        }
      }
    );

    req.on('error', (err) => reject(err));

    req.write(JSON.stringify(data));
    req.end();
  });
}

// helper function, choose a random element from an array
function chooseRandomElement(items) {
  const index = Math.trunc(Math.random() * items.length);
  return items[index];
}

// helper function, sleep for a duration
async function sleep(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

async function lokiSendLogLine(timestampMs, line, tags) {
  // we keep nanosecond-timestamp in a string because
  // as a number it would be too large
  const timestampNs = `${timestampMs}000000`;
  const data = {
    streams: [
      {
        stream: tags,
        values: [[timestampNs, line]],
      },
    ],
  };

  const url = new URL(LOKI_BASE_URL);
  url.pathname = '/loki/api/v1/push';

  await jsonRequest(data, 'POST', url, 204);
}

function getRandomLogItem(counter) {
  const randomText = `${Math.trunc(Math.random() * 1000 * 1000 * 1000)}`;
  const maybeAnsiText = Math.random() < 0.5 ? 'with ANSI \u001b[31mpart of the text\u001b[0m' : '';
  return {
    _entry: `log text ${maybeAnsiText} [${randomText}]`,
    counter: counter.toString(),
    float: Math.random() > 0.2 ? (Math.trunc(100000 * Math.random())/1000).toString() : 'NaN',
    label: chooseRandomElement(['val1', 'val2', 'val3']),
    level: chooseRandomElement(['debug','info', 'info', 'info', 'info', 'warning', 'error', 'error']),
  };
}

function getRandomJSONLogLine(counter) {
  const item = getRandomLogItem(counter)
  return JSON.stringify(item)
}

const logFmtProblemRe = /[="\n]/;

// we are not really escaping things, we just check
// that we don't need to escape :-)
function escapeLogFmtKey(key) {
  if (logFmtProblemRe.test(key)) {
    throw new Error(`invalid logfmt-key: ${key}`)
  }
  return key;
}

function escapeLogFmtValue(value) {
  if (logFmtProblemRe.test(value)) {
    throw new Error(`invalid logfmt-value: ${key}`)
  }

  // we must handle the space-character because we have values with spaces :-(
  return value.indexOf(' ') === -1 ? value : `"${value}"`
}

function logFmtLine(item) {
  const parts = Object.entries(item).map(([k,v]) => {
    const key = escapeLogFmtKey(k.toString());
    const value = escapeLogFmtValue(v.toString());
    return `${key}=${value}`;
  });

  return parts.join(' ');
}

const SLEEP_ANGLE_STEP = Math.PI / 200;
let sleepAngle = 0;
function getNextSineWaveSleepDuration() {
  sleepAngle += SLEEP_ANGLE_STEP;
  return Math.trunc(1000 * Math.abs(Math.sin(sleepAngle)));
}

async function main() {
  for (let step = 0; step < 300; step++) {
    await sleep(getNextSineWaveSleepDuration());
    const timestampMs = new Date().getTime();
    const item = getRandomLogItem(step + 1)
    lokiSendLogLine(timestampMs, JSON.stringify(item), {place:'moon', source: 'data', instance: 'server\\1', job: '"grafana/data"'});
    lokiSendLogLine(timestampMs, logFmtLine(item), {place:'luna', source: 'data', instance: 'server\\2', job: '"grafana/data"'});
  }
}

// when running in docker, we catch the needed stop-signal, to shutdown fast
process.on('SIGTERM', () => {
  console.log('shutdown requested');
  process.exit(0);
});

main();
