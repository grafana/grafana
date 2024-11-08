const http = require('http');

if (process.argv.length !== 3) {
  throw new Error('invalid command line: use node sendLogs.js ELASTIC_BASE_URL');
}

const ELASTIC_BASE_URL = process.argv[2];

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

async function elasticSendLogItem(timestamp, item) {
  // we need the YYYY.MM.DD format
  const timestampText = timestamp.toISOString().slice(0, 10).replace(/-/g, '.');
  const url = new URL(ELASTIC_BASE_URL);
  url.pathname = `/logs-${timestampText}/_doc`;
  await jsonRequest(item, 'POST', url, 201);
}

async function elasticSetupIndexTemplate() {
  const data = {
    index_patterns: ['logs-*'],
    template: {
      mappings: {
        properties: {
          '@timestamp': {
            type: 'date',
          },
          '@timestamp_custom': {
            type: 'date',
            format: 'yyyy_MM_dd_HH_mm_ss'
          },
          '@timestamp_unix': {
            type: 'date',
            format: 'epoch_millis'
          },
          '@timestamp_nanos': {
            type: 'date_nanos',
            format: 'strict_date_optional_time_nanos'
          },
          counter: {
            type: 'integer',
          },
          float: {
            type: 'float',
          },
          level: {
            type: 'keyword',
          },
          label: {
            type: 'keyword',
          },
          location: {
            type: 'geo_point',
          },
          shapes: {
            type: 'nested',
          },
          hostname: {
            type: 'keyword',
          },
          value: {
            type: 'integer',
          },
          metric: {
            type: 'keyword',
          },
          description: {
            type: 'text',
          }
        },
      },
    },
  };
  const url = new URL(ELASTIC_BASE_URL);
  url.pathname = '/_index_template/gdev';
  await jsonRequest(data, 'PUT', url, 200);
}

function makeRandomPoint() {
  const angle = Math.random() * 2 * Math.PI;
  const x = 45 * Math.sin(angle);
  const y = 45 * Math.cos(angle);
  return y + ', ' + x;
}

function getRandomLogItem(counter, timestamp) {
  const randomText = `${Math.trunc(Math.random() * 1000 * 1000 * 1000)}`;
  const maybeAnsiText = Math.random() < 0.5 ? 'with ANSI \u001b[31mpart of the text\u001b[0m' : '';
  return {
    '@timestamp': timestamp.toISOString(),
    '@timestamp_custom': timestamp.toISOString().split('.')[0].replace(/[T:-]/g,'_'),
    '@timestamp_unix': timestamp.getTime(),
    '@timestamp_nanos': timestamp.toISOString().slice(0,-1) + '123Z',
    line: `log text ${maybeAnsiText} [${randomText}]`,
    counter: counter.toString(),
    float: 100 * Math.random().toString(),
    label: chooseRandomElement(['val1', 'val2', 'val3']),
    level: chooseRandomElement(['info', 'info', 'error']),
    // location: chooseRandomElement(LOCATIONS),
    location: makeRandomPoint(),
    shapes: Math.random() < 0.5 ? [
      {"type": "triangle"},
      {"type": "square"},
    ] : [
      {"type": "triangle"},
      {"type": "triangle"},
      {"type": "triangle"},
      {"type": "square"},
    ],
    hostname: chooseRandomElement(['hostname1', 'hostname2', 'hostname3', 'hostname4', 'hostname5', 'hostname6']),
    value: counter,
    metric: chooseRandomElement(['cpu', 'memory', 'latency']),
    description: "this is description",
    slash: "Access to the path '\\\\tkasnpo\\KASNPO\\Files\\contacts.xml' is denied.",
    url: "/foo/blah"
  };
}

let globalCounter = 0;

async function main() {
  await elasticSetupIndexTemplate();
  const SLEEP_ANGLE_STEP = Math.PI / 200;
  let sleepAngle = 0;
  function getNextSineWaveSleepDuration() {
    sleepAngle += SLEEP_ANGLE_STEP;
    return Math.trunc(1000 * Math.abs(Math.sin(sleepAngle)));
  }

  while (true) {
    await sleep(getNextSineWaveSleepDuration());
    const timestamp = new Date();
    const item = getRandomLogItem(globalCounter++, timestamp);
    elasticSendLogItem(timestamp, item);
  }
}

// when running in docker, we catch the needed stop-signal, to shutdown fast
process.on('SIGTERM', () => {
  console.log('shutdown requested');
  process.exit(0);
});

main();
