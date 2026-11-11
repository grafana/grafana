import { assertPluginIdFormat, assertApiVersion, getApiVersion } from './pluginUtils';

describe('getApiVersion', () => {
  it('should resolve the current API version', async () => {
    const url = await getApiVersion();

    expect(url).toBe('v0alpha1');
  });
});

describe('assertPluginIdFormat', () => {
  it.each([
    'grafana-exploretraces-app',
    'grafana-clock-panel',
    'grafana-testdata-datasource',
    'prometheus',
    'text',
    'grafana-synthetic-monitoring-app',
    'grafana-image-renderer',
    'Grafana_Test-123',
  ])('should not throw for plugin ids with valid format %s', (pluginId) => {
    expect(assertPluginIdFormat(pluginId)).toBeUndefined();
  });

  it.each([
    '',
    undefined,
    123,
    true,
    ' ',
    '.',
    '..',
    '...',
    'grafana-exploretraces-app.',
    'grafana-exploretraces-app..',
    'grafana-exploretraces-app...',
    './grafana-exploretraces-app',
    '../grafana-exploretraces-app',
    '.../grafana-exploretraces-app',
    'grafana-exploretraces-app/.',
    'grafana-exploretraces-app/..',
    'grafana-exploretraces-app/../secret',
    'grafana-exploretraces-app/secret',
    'grafana-exploretraces-app\\secret',
    'grafana-exploretraces-app?x=',
    'grafana-exploretraces-app?x=secret',
    'grafana-exploretraces-app#ignored',
    'grafana-exploretraces-app/%2e%2e/secret',
    'grafana-exploretraces-app%2fsecret',
    'grafana-exploretraces-app%5csecret',
    'grafana-exploretraces-app%252fsecret',
    'grafana-exploretraces-app\t',
    'grafana-exploretraces-app\n',
    'grafana-exploretraces-app\r',
    'grafana-exploretraces-app\0',
  ])('should throw for plugin ids with invalid format %s', (pluginId) => {
    expect(() => assertPluginIdFormat(pluginId as unknown as string)).toThrow(`Invalid plugin ID "${pluginId ?? ''}"`);
  });
});

describe('assertApiVersion', () => {
  it('should accept stable API versions', () => {
    expect(assertApiVersion('v1')).toBeUndefined();
  });

  it('should accept alpha API versions', () => {
    expect(assertApiVersion('v0alpha1')).toBeUndefined();
  });

  it('should accept beta API versions', () => {
    expect(assertApiVersion('v1beta1')).toBeUndefined();
  });

  it.each(['', '1', 'v1alpha', 'v1.0'])('should reject malformed API versions: %s', (apiVersion) => {
    expect(() => assertApiVersion(apiVersion)).toThrow(`Invalid API version "${apiVersion}"`);
  });

  it.each(['v1/namespaces/other/app/instance/proxy/secret?x=', 'v1\\secret', 'v1?x=1', 'v1#ignored', 'v1%2fsecret'])(
    'should reject URL segment injection: %s',
    (apiVersion) => {
      expect(() => assertApiVersion(apiVersion)).toThrow(`Invalid API version "${apiVersion}"`);
    }
  );

  it('should reject control characters', () => {
    expect(() => assertApiVersion('v1\t')).toThrow(`Invalid API version "v1\t"`);
    expect(() => assertApiVersion('v1\n')).toThrow(`Invalid API version "v1\n"`);
    expect(() => assertApiVersion('v1\r')).toThrow(`Invalid API version "v1\r"`);
    expect(() => assertApiVersion('v1\0')).toThrow(`Invalid API version "v1\0"`);
  });
});
