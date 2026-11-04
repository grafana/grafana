const path = require('node:path');
const { meter } = require('./instrument.cjs');
const Base = require(path.join(process.env.GRAFANA_JEST_PROFILE_ROOT, 'public/test/happy-dom-environment.js'));

function nameOf(node) {
  const names = [];
  for (; node?.parent; node = node.parent) names.unshift(node.name);
  return names.join(' > ');
}

module.exports = class ProfileEnvironment extends Base {
  constructor(...args) {
    meter.setPhase('environment construction');
    const start = meter.now();
    super(...args);
    meter.span('Happy DOM environment constructor', 'lifecycle', start, meter.now());
    meter.setPhase('Jest bootstrap/setup');
    meter.mark('environment constructed');
  }

  async setup() {
    meter.mark('environment setup start');
    await super.setup();
    meter.mark('environment setup end');
  }

  async handleTestEvent(event, state) {
    switch (event.name) {
      case 'setup':
        meter.mark('test framework ready');
        break;
      case 'run_start':
      case 'run_finish':
        meter.mark(event.name, { memory: process.memoryUsage(), cpu: process.cpuUsage() });
        meter.setPhase(event.name === 'run_start' ? 'between tests' : 'Jest reporting');
        break;
      case 'hook_start':
        this.hook = { start: meter.now(), hookName: `${event.hook.type}: ${nameOf(event.hook.parent)}`, source: event.hook.asyncError?.stack };
        meter.setPhase(`hook: ${event.hook.type}`);
        break;
      case 'hook_success':
      case 'hook_failure': {
        const end = meter.now();
        meter.span(this.hook.hookName, 'hooks', this.hook.start, end);
        meter.mark('hook result', { ...this.hook, durationMs: end - this.hook.start, failed: event.name === 'hook_failure' });
        meter.setPhase('between tests');
        break;
      }
      case 'test_fn_start':
        this.bodyStart = meter.now();
        meter.setPhase('test bodies');
        break;
      case 'test_fn_success':
      case 'test_fn_failure': {
        const end = meter.now();
        const name = nameOf(event.test);
        meter.span(name, 'test bodies', this.bodyStart, end);
        meter.mark('test body result', {
          test: name, durationMs: end - this.bodyStart, failed: event.name === 'test_fn_failure',
          assertions: this.global.expect?.getState().assertionCalls,
        });
        meter.setPhase('between tests');
        break;
      }
    }
    if (super.handleTestEvent) await super.handleTestEvent(event, state);
  }

  async teardown() {
    meter.setPhase('environment teardown');
    meter.mark('teardown start');
    try {
      await super.teardown();
    } finally {
      meter.mark('teardown end');
      meter.setPhase('Jest reporting');
    }
  }
};
