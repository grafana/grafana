import { getPluginIdFromStack } from './v5RouterTelemetry';

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
