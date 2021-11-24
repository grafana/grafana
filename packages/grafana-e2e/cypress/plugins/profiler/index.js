const CDP = require('chrome-remote-interface');
const Tracelib = require('tracelib');
const { mean, mapKeys } = require('lodash');

const defaultState = () => ({
  port: undefined,
  client: undefined,
  tracingPromise: undefined,
  events: [],
});

let state = defaultState();

const getEvents = ({ eventsJson }) => {
  const t = new Tracelib.default(eventsJson);

  const evs = eventsJson.reduce((acc, next) => {
    const name = next?.name;
    if (name) {
      acc[name] = acc[name] ? acc[name] + 1 : 1;
    }
    return acc;
  }, {});

  let fps = t.getFPS();
  return {
    droppedFrames: evs['DroppedFrame'],
    fps: mean(fps.values),
    ...mapKeys(t.getWarningCounts(), (_, key) => `warning-${key}`),
  };
};

function ensureRdpPort(args) {
  if (!Array.isArray(args)) {
    return;
  }
  const existing = args.find((arg) => arg.slice(0, 23) === '--remote-debugging-port');

  if (existing) {
    return Number(existing.split('=')[1]);
  }

  const port = 40000 + Math.round(Math.random() * 25000);
  args.push(`--remote-debugging-port=${port}`);
  return port;
}

const getClient = async () => {
  if (!state.client) {
    console.log('connecting new client' + state.port);
    const client = await CDP({ port: state.port });
    state.client = client;
    return client;
  }

  return state.client;
};

const plugin = {
  initialize: (browser, { args }) => {
    if (browser.family === 'chromium' && browser.name !== 'electron') {
      args.push('--start-fullscreen');
    }

    let caughtPort = ensureRdpPort(args);
    if (typeof caughtPort === 'number') {
      console.log('caught port' + caughtPort);
      state.port = caughtPort;
    } else {
      console.log('not caught port' + JSON.stringify(args));
    }
  },
  startProfiling: async () => {
    console.log('node START');

    const client = await getClient();
    const { Profiler, Runtime, Tracing, Network, Page } = client;

    await Promise.all([Page.enable(), Profiler.enable(), Profiler.setSamplingInterval({ interval: 100 })]);

    const tracingPromise = Tracing.start({
      traceConfig: {
        includedCategories: [
          'disabled-by-default-devtools.timeline.frame',
          'disabled-by-default-devtools.timeline',
          'disabled-by-default-devtools.timeline.inputs',
          'disabled-by-default-devtools.timeline.invalidationTracking',
          'disabled-by-default-devtools.timeline.layers',
          'disabled-by-default-layout_shift.debug',
          'disabled-by-default-cc.debug.scheduler.frames',
          'disabled-by-default-blink.debug.display_lock',
        ],
      },
    });

    await tracingPromise;
    Tracing.dataCollected(({ value: events }) => {
      state.events.push(...events);
    });

    let resolveFn;
    state.tracingPromise = new Promise((resolve) => {
      resolveFn = resolve;
    });
    Tracing.tracingComplete(() => {
      const events = getEvents({
        eventsJson: state.events,
      });

      const data = {
        ...mapKeys(events, (_, key) => `events-${key}`),
      };
      console.log(JSON.stringify(data, null, 2));
      resolveFn();
    });

    return tracingPromise;
  },
  stopProfiling: async () => {
    console.log('node STOP' + state.events.length);
    const client = await getClient();
    const { Profiler, Runtime, Tracing, Network, Page } = client;
    return Tracing.end();
  },
  afterRun: async () => {
    state = defaultState();
  },
  afterSpec: async () => {
    const client = await getClient();
    const { Profiler, Runtime, Tracing, Network, Page } = client;
    if (state.tracingPromise) {
      await state.tracingPromise;
    }

    state.events = [];
    console.log('after spec');
  },
};

module.exports = plugin;
