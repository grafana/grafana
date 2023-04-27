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

async function lokiSendLogLine(timestampNs, line, tags) {
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

function getSineValue(counter, loopLength) {
  // we try to make a sine-wave, where one full "loop" takes loopLength steps
  return Math.sin((Math.PI * 2 * counter) / loopLength);
}

function getRandomLogItem(counter) {
  const randomText = `${Math.trunc(Math.random() * 1000 * 1000 * 1000)}`;
  const maybeAnsiText = Math.random() < 0.5 ? 'with ANSI \u001b[31mpart of the text\u001b[0m' : '';
  return {
    _entry: `log text ${maybeAnsiText} [${randomText}]`,
    counter: counter.toString(),
    float: Math.random() > 0.2 ? (Math.trunc(100000 * Math.random())/1000).toString() : 'NaN',
    wave: getSineValue(counter, 20), // let's loop in 20 steps
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
    throw new Error(`invalid logfmt-value: ${value}`)
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

const DAYS = 7;
const POINTS_PER_DAY = 1000;

// it's important to have good "delays" between
// log-line-timestamps, because the "density" of log-lines
// is what gives the loki metric queries shape.
function calculateDelays(pointsCount) {
  const delays = [];
  for(let i=0;i<pointsCount; i+=1) {
    const delay = Math.random();
    delays.push(delay);
  }
  // now, i want to normalize the delays-array, so that the sum of
  // all it's items adds up to `1`.
  const allDelays = delays.reduce((acc, current) => acc + current, 0);

  for(let i=0;i<delays.length; i++) {
    delays[i] = delays[i] / allDelays
  }

  return delays;
}

function getRandomNanosecPart() {
  // we want to have cases with milliseconds-only, with microsec and nanosec.
  const mode = Math.random();

  if (mode < 0.333) {
    // only milisec precision
    return '000000';
  }

  if (mode < 0.666) {
    // microsec precision
    return Math.trunc(Math.random()*1000).toString().padStart(3, '0') + '000'
  }

  // nanosec precision
  return Math.trunc(Math.random()*1000000).toString().padStart(6, '0')
}

const sharedLabels = {
  source: 'data',
  instance: 'server\\1',
  job: '"grafana/data"'
};

let globalCounter = 0;

async function sendOldLogs() {
  const delays = calculateDelays(DAYS * POINTS_PER_DAY);
  const timeRange = DAYS * 24 * 60 * 60 * 1000;
  let timestampMs = new Date().getTime() - timeRange;
  for(let i =0; i < delays.length; i++ ) { // i cannot do a forEach because of the `await` inside
    const delay = delays[i];
    timestampMs += Math.trunc(delay * timeRange);
    const timestampNs = `${timestampMs}${getRandomNanosecPart()}`;
    globalCounter += 1;
    const item = getRandomLogItem(globalCounter)
    await lokiSendLogLine(timestampNs, JSON.stringify(item), {place:'moon', ...sharedLabels});
    await lokiSendLogLine(timestampNs, logFmtLine(item), {place:'luna', ...sharedLabels});
  };
}

async function sendNewLogs() {
  while(true) {
    globalCounter += 1;
    const nowMs = new Date().getTime();
    const timestampNs = `${nowMs}${getRandomNanosecPart()}`;
    const item = getRandomLogItem(globalCounter)
    await lokiSendLogLine(timestampNs, JSON.stringify(item), {place:'moon', ...sharedLabels});
    await lokiSendLogLine(timestampNs, logFmtLine(item), {place:'luna', ...sharedLabels});
    const sleepDuration  = 200 + Math.random() * 800; // between 0.2 and 1 seconds
    await sleep(sleepDuration);
  }
}

async function main() {
  // first we send logs to build a last-7-days log-data
  await sendOldLogs();
  // then keep sending new data forever
  await sendNewLogs();
}

// when running in docker, we catch the needed stop-signal, to shutdown fast
process.on('SIGTERM', () => {
  console.log('shutdown requested');
  process.exit(0);
});

main();
