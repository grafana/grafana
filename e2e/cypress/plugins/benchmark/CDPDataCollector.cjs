const CDP = require('chrome-remote-interface');
const { countBy, mean } = require('lodash');
const Tracelib = require('tracelib');

class CDPDataCollector {
  tracingCategories;
  state;

  constructor(deps) {
    this.state = this.getDefaultState();
    this.tracingCategories = [
      'disabled-by-default-v8.cpu_profile',
      'disabled-by-default-v8.cpu_profiler',
      'disabled-by-default-v8.cpu_profiler.hires',
      'disabled-by-default-devtools.timeline.frame',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.inputs',
      'disabled-by-default-devtools.timeline.stack',
      'disabled-by-default-devtools.timeline.invalidationTracking',
      'disabled-by-default-layout_shift.debug',
      'disabled-by-default-cc.debug.scheduler.frames',
      'disabled-by-default-blink.debug.display_lock',
    ];
  }

  getName = () => DataCollectorName.CDP;

  resetState = async () => {
    if (this.state.client) {
      await this.state.client.close();
    }
    this.state = this.getDefaultState();
  };

  getDefaultState = () => ({
    traceEvents: [],
  });

  // workaround for type declaration issues in cdp lib
  asApis = (client) => client;

  getClientApis = async () => this.asApis(await this.getClient());

  getClient = async () => {
    if (this.state.client) {
      return this.state.client;
    }

    const client = await CDP({ port: this.deps.port });

    const { Profiler, Page } = this.asApis(client);
    await Promise.all([Page.enable(), Profiler.enable(), Profiler.setSamplingInterval({ interval: 100 })]);

    this.state.client = client;

    return client;
  };

  start = async ({ id }) => {
    if (this.state.tracingPromise) {
      throw new Error(`collection in progress - can't start another one! ${id}`);
    }

    const { Tracing, Profiler } = await this.getClientApis();

    await Promise.all([
      Tracing.start({
        bufferUsageReportingInterval: 1000,
        traceConfig: {
          includedCategories: this.tracingCategories,
        },
      }),
      Profiler.start(),
    ]);

    Tracing.on('dataCollected', ({ value: events }) => {
      this.state.traceEvents.push(...events);
    });

    let resolveFn;
    this.state.tracingPromise = new Promise((resolve) => {
      resolveFn = resolve;
    });
    Tracing.on('tracingComplete', ({ dataLossOccurred }) => {
      const t = new Tracelib(this.state.traceEvents);

      const eventCounts = countBy(this.state.traceEvents, (ev) => ev.name);

      const fps = t.getFPS();

      resolveFn({
        eventCounts,
        fps: mean(fps.values),
        tracingDataLoss: dataLossOccurred ? 1 : 0,
        warnings: t.getWarningCounts(),
      });
    });
  };

  stop = async (req) => {
    if (!this.state.tracingPromise) {
      throw new Error(`collection was never started - there is nothing to stop!`);
    }

    const { Tracing, Profiler } = await this.getClientApis();

    // TODO: capture profiler data
    const [, , traceData] = await Promise.all([Profiler.stop(), Tracing.end(), this.state.tracingPromise]);

    await this.resetState();

    return traceData;
  };

  close = async () => {
    await this.resetState();
  };
}

exports.CDPDataCollector = CDPDataCollector;
