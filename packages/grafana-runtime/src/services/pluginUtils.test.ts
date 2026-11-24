import { invalidateAPIDiscovery, setAPIDiscoveryForTesting } from './apiDiscovery/discovery';
import { setLogger } from './logging/registry';
import {
  assertPluginIdFormat,
  assertApiVersion,
  getApiVersion,
  assertUIDFormat,
  getCacheKey,
  resolveAppPluginAPIVersion,
} from './pluginUtils';

describe('getApiVersion', () => {
  it('should resolve the current API version', async () => {
    const url = await getApiVersion();

    expect(url).toBe('v0alpha1');
  });
});

describe('resolveAppPluginAPIVersion', () => {
  afterEach(() => {
    invalidateAPIDiscovery();
  });

  it('resolves the version from the API group named after the plugin', async () => {
    setAPIDiscoveryForTesting([{ group: 'myorg-test-app', versions: ['v1', 'v0alpha1'], preferredVersion: 'v1' }]);

    await expect(resolveAppPluginAPIVersion('myorg-test-app')).resolves.toBe('v0alpha1');
  });

  it('returns undefined when the group is not served', async () => {
    setAPIDiscoveryForTesting([{ group: 'other-app', versions: ['v0alpha1'], preferredVersion: 'v0alpha1' }]);

    await expect(resolveAppPluginAPIVersion('myorg-test-app')).resolves.toBeUndefined();
  });

  it('returns undefined when the group serves no supported version', async () => {
    setAPIDiscoveryForTesting([{ group: 'myorg-test-app', versions: ['v1'], preferredVersion: 'v1' }]);

    await expect(resolveAppPluginAPIVersion('myorg-test-app')).resolves.toBeUndefined();
  });

  it.each(['MyOrg-test-app', 'myorg_test_app', '-myorg-test-app'])(
    'returns undefined without asking discovery when %s cannot be an API group name',
    async (pluginId) => {
      const logWarning = jest.fn();
      setLogger('grafana/runtime.apis.discovery', {
        logDebug: jest.fn(),
        logError: jest.fn(),
        logInfo: jest.fn(),
        logMeasurement: jest.fn(),
        logWarning,
      });
      setAPIDiscoveryForTesting([{ group: pluginId, versions: ['v0alpha1'], preferredVersion: 'v0alpha1' }]);

      await expect(resolveAppPluginAPIVersion(pluginId)).resolves.toBeUndefined();
      expect(logWarning).not.toHaveBeenCalled();
    }
  );
});

describe('getCacheKey', () => {
  it('keys app plugin settings by plugin and API version', () => {
    expect(getCacheKey('myorg-test-app', 'v0alpha1')).not.toBe(getCacheKey('myorg-test-app', 'v1'));
    expect(getCacheKey('myorg-test-app', 'v0alpha1')).not.toBe(getCacheKey('other-app', 'v0alpha1'));
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

describe('assertUIDFormat', () => {
  it.each(['grafanacloud-traces', 'Grafana_cloud-Traces-123', 'tempo'])(
    'should not throw for uids with valid format %s',
    (uid) => {
      expect(assertUIDFormat(uid)).toBeUndefined();
    }
  );

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
  ])('should throw for uids with invalid format %s', (uid) => {
    expect(() => assertUIDFormat(uid as unknown as string)).toThrow(`Invalid UID "${uid ?? ''}"`);
  });

  it('should return undefined for an uid with one char', () => {
    expect(assertUIDFormat('a')).toBeUndefined();
  });

  it('should return undefined for an uid with 40 chars', () => {
    expect(assertUIDFormat('0123456789012345678901234567890123456789')).toBeUndefined();
  });

  it('should throw for an uid with 41 chars', () => {
    expect(() => assertUIDFormat('01234567890123456789012345678901234567890')).toThrow(
      `Invalid UID "01234567890123456789012345678901234567890"`
    );
  });
});
