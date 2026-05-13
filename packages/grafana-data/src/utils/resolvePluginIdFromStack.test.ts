import { resolvePluginIdFromStack } from './resolvePluginIdFromStack';

describe('resolvePluginIdFromStack', () => {
  it('extracts pluginId from /public/plugins/<id>/ frame', () => {
    const stack = [
      'Error',
      '    at reporter (http://localhost:3000/public/build/runtime.js:1:1)',
      '    at handler (http://localhost:3000/public/plugins/grafana-clock-panel/module.js:55:12)',
    ].join('\n');
    expect(resolvePluginIdFromStack(stack)).toBe('grafana-clock-panel');
  });

  it('extracts pluginId from /api/plugins/<id>/ frame', () => {
    const stack = '    at fn (http://example.com/api/plugins/acme-datasource/resources/module.js:10:1)';
    expect(resolvePluginIdFromStack(stack)).toBe('acme-datasource');
  });

  it('returns "unknown" when no plugin frame is present', () => {
    const stack = '    at PanelChrome (http://localhost:3000/public/build/app.js:9000:1)';
    expect(resolvePluginIdFromStack(stack)).toBe('unknown');
  });

  it('returns "unknown" when stack is undefined', () => {
    expect(resolvePluginIdFromStack(undefined)).toBe('unknown');
  });

  it('returns the first matching plugin frame', () => {
    const stack = [
      '    at outer (http://localhost:3000/public/plugins/first/module.js:1:1)',
      '    at inner (http://localhost:3000/public/plugins/second/module.js:1:1)',
    ].join('\n');
    expect(resolvePluginIdFromStack(stack)).toBe('first');
  });

  it('extracts pluginId from Firefox-style stack frame (no parens)', () => {
    const stack = 'handler@http://localhost:3000/public/plugins/foo-panel/module.js:10:1';
    expect(resolvePluginIdFromStack(stack)).toBe('foo-panel');
  });

  it('extracts pluginId from a URL with a query string', () => {
    const stack = '    at handler (http://localhost:3000/public/plugins/bar-panel/module.js?v=12345:10:1)';
    expect(resolvePluginIdFromStack(stack)).toBe('bar-panel');
  });
});
