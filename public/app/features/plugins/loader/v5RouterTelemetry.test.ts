import { type MonitoringLogger } from '@grafana/runtime';
import { mockLogger } from '@grafana/test-utils/unstable';

import { getPluginIdFromStack, reportV5Usage, withV5UsageTelemetry } from './v5RouterTelemetry';

// Chrome-shaped frames. The parser is deliberately format-agnostic, so one
// browser's shape is enough to cover the common case.
function chromeStack(...frames: string[]) {
  return ['Error', ...frames.map((frame) => `    at ${frame}`)].join('\n');
}

describe('getPluginIdFromStack', () => {
  it('reads the plugin id from a locally served bundle', () => {
    const stack = chromeStack(
      'reportV5Usage (http://localhost:3000/public/build/runtime.js:1:1)',
      'MyPage (http://localhost:3000/public/plugins/grafana-assistant-app/module.js:2:3)'
    );

    expect(getPluginIdFromStack(stack)).toBe('grafana-assistant-app');
  });

  it('reads the plugin id from a CDN hosted bundle', () => {
    const stack = chromeStack(
      'reportV5Usage (http://localhost:3000/public/build/runtime.js:1:1)',
      'MyPage (https://cdn.example.com/my-plugin/0.3.3/public/plugins/my-plugin/module.js:2:3)'
    );

    expect(getPluginIdFromStack(stack)).toBe('my-plugin');
  });

  it('reads the plugin id when Grafana is served from a sub path', () => {
    const stack = chromeStack('MyPage (http://localhost:3000/grafana/public/plugins/my-plugin/module.js:2:3)');

    expect(getPluginIdFromStack(stack)).toBe('my-plugin');
  });

  it('reads the plugin id from a lazy chunk inside the plugin', () => {
    const stack = chromeStack('MyPage (http://localhost:3000/public/plugins/my-plugin/chunks/482.js:2:3)');

    expect(getPluginIdFromStack(stack)).toBe('my-plugin');
  });

  it('takes the first plugin frame, which is the nearest caller', () => {
    const stack = chromeStack(
      'reportV5Usage (http://localhost:3000/public/build/runtime.js:1:1)',
      'MyPage (http://localhost:3000/public/plugins/inner-plugin/module.js:2:3)',
      'Host (http://localhost:3000/public/plugins/outer-plugin/module.js:4:5)'
    );

    expect(getPluginIdFromStack(stack)).toBe('inner-plugin');
  });

  it('reads Firefox shaped frames', () => {
    const stack = ['MyPage@http://localhost:3000/public/plugins/my-plugin/module.js:2:3'].join('\n');

    expect(getPluginIdFromStack(stack)).toBe('my-plugin');
  });

  it('returns undefined when no frame belongs to a plugin', () => {
    const stack = chromeStack('RoutesWrapper (http://localhost:3000/public/build/app.js:1:1)');

    expect(getPluginIdFromStack(stack)).toBeUndefined();
  });

  it('returns undefined when there is no stack', () => {
    expect(getPluginIdFromStack(undefined)).toBeUndefined();
  });
});

function pluginStack(pluginId: string) {
  return chromeStack(`MyPage (http://localhost:3000/public/plugins/${pluginId}/module.js:2:3)`);
}

// The dedupe set lives at module scope and has no reset hook, because production
// code should not carry one. Each test therefore uses its own plugin id.
describe('reportV5Usage', () => {
  let logger: MonitoringLogger;

  beforeEach(() => {
    logger = mockLogger('features.plugins');
  });

  it('reports the plugin id and the export name', () => {
    reportV5Usage('useHistory', pluginStack('reports-once-app'));

    expect(logger.logWarning).toHaveBeenCalledTimes(1);
    const [, context] = jest.mocked(logger.logWarning).mock.calls[0];
    expect(context).toMatchObject({ pluginId: 'reports-once-app', exportName: 'useHistory' });
  });

  it('reports the same plugin and export only once', () => {
    reportV5Usage('useHistory', pluginStack('deduped-app'));
    reportV5Usage('useHistory', pluginStack('deduped-app'));
    reportV5Usage('useHistory', pluginStack('deduped-app'));

    expect(logger.logWarning).toHaveBeenCalledTimes(1);
  });

  it('reports the same export again for a different plugin', () => {
    reportV5Usage('useHistory', pluginStack('first-app'));
    reportV5Usage('useHistory', pluginStack('second-app'));

    expect(logger.logWarning).toHaveBeenCalledTimes(2);
  });

  it('reports a different export again for the same plugin', () => {
    reportV5Usage('useHistory', pluginStack('two-exports-app'));
    reportV5Usage('Redirect', pluginStack('two-exports-app'));

    expect(logger.logWarning).toHaveBeenCalledTimes(2);
  });

  it('reports the stack when it cannot find a plugin', () => {
    const stack = chromeStack('RoutesWrapper (http://localhost:3000/public/build/app.js:1:1)');

    reportV5Usage('withRouter', stack);

    expect(logger.logWarning).toHaveBeenCalledTimes(1);
    const [, context] = jest.mocked(logger.logWarning).mock.calls[0];
    expect(context).toMatchObject({ exportName: 'withRouter', stack });
    expect(context).not.toHaveProperty('pluginId');
  });
});

function fakeRouterModule() {
  return {
    useHistory: jest.fn((..._args: unknown[]) => 'history-value'),
    useRouteMatch: jest.fn((..._args: unknown[]) => 'match-value'),
    withRouter: jest.fn((..._args: unknown[]) => 'wrapped-component'),
    // v6 keeps this one, so it must pass through untouched.
    useLocation: jest.fn((..._args: unknown[]) => 'location-value'),
  };
}

describe('withV5UsageTelemetry function exports', () => {
  let logger: MonitoringLogger;

  beforeEach(() => {
    logger = mockLogger('features.plugins');
  });

  it.each(['useHistory', 'useRouteMatch', 'withRouter'] as const)('returns what %s returns', (exportName) => {
    const module = fakeRouterModule();
    const wrapped = withV5UsageTelemetry(module);

    expect(wrapped[exportName]()).toBe(module[exportName]());
  });

  it.each(['useHistory', 'useRouteMatch', 'withRouter'] as const)('passes arguments to %s', (exportName) => {
    const module = fakeRouterModule();
    const wrapped = withV5UsageTelemetry(module);

    wrapped[exportName]('first', 'second');

    expect(module[exportName]).toHaveBeenCalledWith('first', 'second');
  });

  it('reports repeated calls from one place only once', () => {
    const wrapped = withV5UsageTelemetry(fakeRouterModule());

    for (let i = 0; i < 3; i++) {
      wrapped.useHistory();
    }

    expect(logger.logWarning).toHaveBeenCalledTimes(1);
  });

  it('leaves exports that v6 keeps untouched', () => {
    const module = fakeRouterModule();
    const wrapped = withV5UsageTelemetry(module);

    expect(wrapped.useLocation).toBe(module.useLocation);

    wrapped.useLocation();

    expect(logger.logWarning).not.toHaveBeenCalled();
  });
});
