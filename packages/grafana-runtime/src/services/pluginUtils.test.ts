import { app } from './pluginMeta/test-fixtures/config.apps';
import { prometheusMeta } from './pluginMeta/test-fixtures/config.datasources';
import { panel } from './pluginMeta/test-fixtures/config.panels';
import { isValidApiVersion, isValidPluginId, validatePluginId } from './pluginUtils';

describe('validatePluginId', () => {
  it('should accept app plugin IDs', () => {
    expect(validatePluginId('grafana-exploretraces-app')).toBe(true);
  });

  it('should accept panel plugin IDs', () => {
    expect(validatePluginId('grafana-clock-panel')).toBe(true);
  });

  it('should accept datasource plugin IDs', () => {
    expect(validatePluginId('grafana-testdata-datasource')).toBe(true);
  });

  it('should reject bare core plugin IDs', () => {
    expect(validatePluginId('prometheus')).toBe(false);
  });

  it('should reject URL segment injection', () => {
    expect(validatePluginId('my-app/secret?x=')).toBe(false);
    expect(validatePluginId('my-app/secret')).toBe(false);
    expect(validatePluginId('my-app\\secret')).toBe(false);
    expect(validatePluginId('my-app?x=secret')).toBe(false);
    expect(validatePluginId('my-app#ignored')).toBe(false);
  });

  it('should reject percent-encoded path separators', () => {
    expect(validatePluginId('my-app%2fsecret')).toBe(false);
    expect(validatePluginId('my-app%5csecret')).toBe(false);
    expect(validatePluginId('my-app%252fsecret')).toBe(false);
  });

  it('should reject control characters', () => {
    expect(validatePluginId('grafana-example-app\t')).toBe(false);
    expect(validatePluginId('grafana-example-app\n')).toBe(false);
    expect(validatePluginId('grafana-example-app\r')).toBe(false);
    expect(validatePluginId('grafana-example-app\0')).toBe(false);
  });
});

describe('isValidPluginId', () => {
  it('should accept plugin IDs matching the naming convention', () => {
    expect(isValidPluginId({ pluginId: 'grafana-exploretraces-app' })).toBe(true);
  });

  it('should accept known app plugin IDs', () => {
    expect(isValidPluginId({ pluginId: 'myorg-someplugin-app', apps: [app] })).toBe(true);
  });

  it('should accept known datasource plugin IDs', () => {
    expect(isValidPluginId({ pluginId: 'prometheus', datasources: [prometheusMeta] })).toBe(true);
  });

  it('should accept known panel plugin IDs', () => {
    expect(isValidPluginId({ pluginId: 'grafana-test-panel', panels: [panel] })).toBe(true);
  });

  it('should reject unknown plugin IDs', () => {
    expect(isValidPluginId({ pluginId: 'unknown', apps: [app], datasources: [prometheusMeta], panels: [panel] })).toBe(
      false
    );
  });

  it.each(['prometheus/secret', 'prometheus\\secret', 'prometheus?x=1', 'prometheus#ignored', 'prometheus%2fsecret'])(
    'should reject URL segment injection for known plugin IDs: %s',
    (pluginId) => {
      expect(isValidPluginId({ pluginId, datasources: [prometheusMeta] })).toBe(false);
    }
  );
});

describe('isValidApiVersion', () => {
  it('should accept stable API versions', () => {
    expect(isValidApiVersion('v1')).toBe(true);
  });

  it('should accept alpha API versions', () => {
    expect(isValidApiVersion('v0alpha1')).toBe(true);
  });

  it('should accept beta API versions', () => {
    expect(isValidApiVersion('v1beta1')).toBe(true);
  });

  it.each(['', '1', 'v1alpha', 'v1.0'])('should reject malformed API versions: %s', (apiVersion) => {
    expect(isValidApiVersion(apiVersion)).toBe(false);
  });

  it.each(['v1/namespaces/other/app/instance/proxy/secret?x=', 'v1\\secret', 'v1?x=1', 'v1#ignored', 'v1%2fsecret'])(
    'should reject URL segment injection: %s',
    (apiVersion) => {
      expect(isValidApiVersion(apiVersion)).toBe(false);
    }
  );

  it('should reject control characters', () => {
    expect(isValidApiVersion('v1\t')).toBe(false);
    expect(isValidApiVersion('v1\n')).toBe(false);
    expect(isValidApiVersion('v1\r')).toBe(false);
    expect(isValidApiVersion('v1\0')).toBe(false);
  });
});
