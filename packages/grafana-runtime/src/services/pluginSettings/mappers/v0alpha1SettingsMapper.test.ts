import {
  type GrafanaConfig,
  locationUtil,
  PluginIncludeType,
  PluginLoadingStrategy,
  PluginSignatureStatus,
  PluginSignatureType,
  PluginState,
  PluginType,
} from '@grafana/data';

import { setLogger } from '../../logging/registry';
import { myOrgTestAppMeta } from '../../pluginMeta/test-fixtures/v0alpha1Response';
import type { Include as v0alpha1Include, Spec as v0alpha1Spec } from '../../pluginMeta/types/meta/types.spec.gen';
import { myOrgTestAppSettings } from '../test-fixtures/v0alpha1Response';
import { type InlineSecureValue } from '../types';

import {
  includesMapper,
  includeTypeMapper,
  inlineSecureValuesMapper,
  secureJsonFieldsMapper,
  settingsSpecMapper,
  signatureStatusMapper,
  signatureTypeMapper,
  slugMapper,
  stateMapper,
  typeMapper,
  v0alpha1SettingsMapper,
} from './v0alpha1SettingsMapper';

describe('v0alpha1SettingsMapper', () => {
  beforeEach(() => {
    setLogger('grafana/runtime.plugins.settings', {
      logDebug: jest.fn(),
      logError: jest.fn(),
      logInfo: jest.fn(),
      logMeasurement: jest.fn(),
      logWarning: jest.fn(),
    });
    locationUtil.initialize({
      config: { appSubUrl: '' } as GrafanaConfig,
      getTimeRangeForUrl: jest.fn(),
      getVariablesUrlParams: jest.fn(),
    });
  });

  it('should hardcode autoEnabled to false', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).autoEnabled).toBe(false);
  });

  it('should map baseUrl correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).baseUrl).toStrictEqual(
      'public/plugins/myorg-test-app'
    );
  });

  it('should map defaultNavUrl correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).defaultNavUrl).toStrictEqual(
      '/plugins/myorg-test-app/page/page-one'
    );
  });

  it('should hardcode hasUpdate to false', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).hasUpdate).toBe(false);
  });

  it('should map id correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).id).toStrictEqual('myorg-test-app');
  });

  it('should map info correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).info).toStrictEqual({
      author: { name: 'Myorg', url: '' },
      build: {},
      description: '',
      keywords: ['app'],
      links: [],
      logos: {
        large: 'public/plugins/myorg-test-app/img/logo.svg',
        small: 'public/plugins/myorg-test-app/img/logo.svg',
      },
      screenshots: [],
      updated: '2026-04-20',
      version: '1.0.0',
    });
  });

  it('should hardcode latestVersion to emptyString', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).latestVersion).toBe('');
  });

  it('should map module correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).module).toStrictEqual(
      'public/plugins/myorg-test-app/module.js'
    );
  });

  it('should map name correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).name).toStrictEqual('Test');
  });

  it('should map type correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).type).toStrictEqual(PluginType.app);
  });

  it('should map aliasIDs correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).aliasIDs).toStrictEqual(['fake-alias']);
  });

  it('should map angular correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).angular).toStrictEqual({
      detected: false,
    });
  });

  it('should hardcode angularDetected to false', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).angularDetected).toBe(false);
  });

  it('should map dependencies correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).dependencies).toStrictEqual({
      extensions: { exposedComponents: [] },
      grafanaDependency: '>=12.3.0',
      grafanaVersion: '*',
      plugins: [],
    });
  });

  it('should map enabled correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).enabled).toBe(true);
  });

  it('should map extensions correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).extensions).toStrictEqual({
      addedComponents: [],
      addedFunctions: [],
      addedLinks: [],
      exposedComponents: [],
      extensionPoints: [],
    });
  });

  it('should map includes correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).includes).toStrictEqual([
      {
        action: 'plugins.app:access',
        addToNav: true,
        component: '',
        defaultNav: true,
        icon: '',
        name: 'Page One',
        path: '/a/myorg-test-app/one',
        role: 'Viewer',
        slug: 'page-one',
        type: 'page',
        uid: '',
      },
      {
        action: 'plugins.app:access',
        addToNav: true,
        component: '',
        defaultNav: false,
        icon: '',
        name: 'Page Two',
        path: '/a/myorg-test-app/two',
        role: 'Viewer',
        slug: 'page-two',
        type: 'page',
        uid: '',
      },
      {
        action: 'plugins.app:access',
        addToNav: true,
        component: '',
        defaultNav: false,
        icon: '',
        name: 'Page Three',
        path: '/a/myorg-test-app/three',
        role: 'Viewer',
        slug: 'page-three',
        type: 'page',
        uid: '',
      },
      {
        action: 'plugins.app:access',
        addToNav: true,
        component: '',
        defaultNav: false,
        icon: '',
        name: 'Page Four',
        path: '/a/myorg-test-app/four',
        role: 'Viewer',
        slug: 'page-four',
        type: 'page',
        uid: '',
      },
      {
        addToNav: true,
        component: '',
        defaultNav: false,
        icon: 'cog',
        name: 'Configuration',
        path: '/plugins/myorg-test-app',
        role: 'Admin',
        slug: 'configuration',
        type: 'page',
        uid: '',
      },
    ]);
  });

  it('should map jsonData correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).jsonData).toStrictEqual({
      apiUrl: 'http://api-url.com',
    });
  });

  it('should map loadingStrategy correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).loadingStrategy).toStrictEqual(
      PluginLoadingStrategy.script
    );
  });

  it('should map moduleHash correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).moduleHash).toStrictEqual('fake hash');
  });

  it('should map pinned correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).pinned).toBe(false);
  });

  it('should map secureJsonFields correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).secureJsonFields).toStrictEqual({
      apiKey: true,
      password: true,
    });
  });

  it('should map signature correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).signature).toStrictEqual('unsigned');
  });

  it('should map signatureOrg correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).signatureOrg).toStrictEqual('');
  });

  it('should map signatureType correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).signatureType).toStrictEqual('');
  });

  it('should map state correctly', () => {
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).state).toStrictEqual('');
  });
});

describe('defaultNavUrlMapper', () => {
  it('should return undefined if there are no includes', () => {
    myOrgTestAppMeta.spec.pluginJson.includes = [];

    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).defaultNavUrl).toBeUndefined();
  });

  it('should return undefined if there is no default include', () => {
    myOrgTestAppMeta.spec.pluginJson.includes = [{ defaultNav: false }];

    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).defaultNavUrl).toBeUndefined();
  });

  it('should return undefined if the default include is of type datasource', () => {
    myOrgTestAppMeta.spec.pluginJson.includes = [
      { defaultNav: false, name: 'Help Page', type: 'dashboard' },
      { defaultNav: true, type: 'datasource', name: 'Main Page' },
    ];

    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).defaultNavUrl).toBeUndefined();
  });

  it('should return undefined if the default include is of type panel', () => {
    myOrgTestAppMeta.spec.pluginJson.includes = [
      { defaultNav: false, name: 'Help Page', type: 'dashboard' },
      { defaultNav: true, type: 'panel', name: 'Main Page' },
    ];

    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).defaultNavUrl).toBeUndefined();
  });

  it('should return undefined if the default include is of type dashboard but missing the uid', () => {
    myOrgTestAppMeta.spec.pluginJson.includes = [
      { defaultNav: false, name: 'Help Page', type: 'dashboard' },
      { defaultNav: true, type: 'dashboard', name: 'Main Page' },
    ];

    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).defaultNavUrl).toBeUndefined();
  });

  it('should return correct url if the default include is of type page', () => {
    myOrgTestAppMeta.spec.pluginJson.includes = [
      { defaultNav: false, name: 'Help Page', type: 'page' },
      { defaultNav: true, type: 'page', name: 'Main Page' },
    ];

    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).defaultNavUrl).toStrictEqual(
      '/plugins/myorg-test-app/page/main-page'
    );
  });

  it('should return correct url if the default include is of type dashboard and has uid', () => {
    myOrgTestAppMeta.spec.pluginJson.includes = [
      { defaultNav: false, name: 'Help Page', type: 'dashboard', uid: 'abc' },
      { defaultNav: true, type: 'dashboard', name: 'Main Page', uid: 'def' },
    ];

    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).defaultNavUrl).toStrictEqual('/d/def');
  });

  describe('when there is an appSubUrl configured', () => {
    beforeEach(() => {
      locationUtil.initialize({
        config: { appSubUrl: '/gf' } as GrafanaConfig,
        getTimeRangeForUrl: jest.fn(),
        getVariablesUrlParams: jest.fn(),
      });
    });

    it('should return correct url if the default include is of type page', () => {
      myOrgTestAppMeta.spec.pluginJson.includes = [
        { defaultNav: false, name: 'Help Page', type: 'page' },
        { defaultNav: true, type: 'page', name: 'Main Page' },
      ];

      expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).defaultNavUrl).toStrictEqual(
        '/gf/plugins/myorg-test-app/page/main-page'
      );
    });

    it('should return correct url if the default include is of type dashboard and has uid', () => {
      myOrgTestAppMeta.spec.pluginJson.includes = [
        { defaultNav: false, name: 'Help Page', type: 'dashboard', uid: 'abc' },
        { defaultNav: true, type: 'dashboard', name: 'Main Page', uid: 'def' },
      ];

      expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).defaultNavUrl).toStrictEqual(
        '/gf/d/def'
      );
    });
  });
});

describe('signatureTypeMapper', () => {
  it.each([
    { type: 'commercial', expected: PluginSignatureType.commercial },
    { type: 'community', expected: PluginSignatureType.community },
    { type: 'grafana', expected: PluginSignatureType.grafana },
    { type: 'private', expected: PluginSignatureType.private },
    { type: 'private-glob', expected: 'private-glob' },
    { type: '', expected: '' },
    { type: null, expected: '' },
    { type: undefined, expected: '' },
  ])(`when called with $type then it should map to $expected`, ({ expected, type }) => {
    myOrgTestAppMeta.spec.signature.type = type as v0alpha1Spec['signature']['type'];
    expect(signatureTypeMapper(myOrgTestAppMeta.spec)).toStrictEqual(expected);
  });
});

describe('signatureStatusMapper', () => {
  it.each([
    { status: 'internal', expected: PluginSignatureStatus.internal },
    { status: 'invalid', expected: PluginSignatureStatus.invalid },
    { status: 'modified', expected: PluginSignatureStatus.modified },
    { status: 'valid', expected: PluginSignatureStatus.valid },
    { status: 'unsigned', expected: 'unsigned' },
    { status: '', expected: '' },
    { status: null, expected: '' },
    { status: undefined, expected: '' },
  ])(`when called with $status then it should map to $expected`, ({ expected, status }) => {
    myOrgTestAppMeta.spec.signature.status = status as v0alpha1Spec['signature']['status'];
    expect(signatureStatusMapper(myOrgTestAppMeta.spec)).toStrictEqual(expected);
  });
});

describe('includesMapper', () => {
  it('should return an empty array if includes are missing from spec', () => {
    delete myOrgTestAppMeta.spec.pluginJson.includes;

    expect(includesMapper(myOrgTestAppMeta.spec)).toStrictEqual([]);
  });

  it('should return a slug', () => {
    myOrgTestAppMeta.spec.pluginJson.includes = [{ name: 'Main Page' }];

    const actual = includesMapper(myOrgTestAppMeta.spec);

    expect(actual).toHaveLength(1);
    expect(actual[0].name).toStrictEqual('Main Page');
    expect(actual[0].slug).toStrictEqual('main-page');
  });

  it('should return a type', () => {
    myOrgTestAppMeta.spec.pluginJson.includes = [{ type: 'dashboard' }];

    const actual = includesMapper(myOrgTestAppMeta.spec);

    expect(actual).toHaveLength(1);
    expect(actual[0].type).toStrictEqual(PluginIncludeType.dashboard);
  });

  it.each([
    { prop: 'name' },
    { prop: 'type' },
    { prop: 'component' },
    { prop: 'icon' },
    { prop: 'path' },
    { prop: 'role' },
    { prop: 'uid' },
  ])(`should return an empty string if $prop is missing from spec`, ({ prop }) => {
    myOrgTestAppMeta.spec.pluginJson.includes = [{}];

    const actual = includesMapper(myOrgTestAppMeta.spec) as unknown as Array<Record<string, unknown>>;

    expect(actual).toHaveLength(1);
    expect(actual[0][prop]).toStrictEqual('');
  });

  it.each([{ prop: 'addToNav' }, { prop: 'defaultNav' }])(
    `should return false if $prop is missing from spec`,
    ({ prop }) => {
      myOrgTestAppMeta.spec.pluginJson.includes = [{}];

      const actual = includesMapper(myOrgTestAppMeta.spec) as unknown as Array<Record<string, unknown>>;

      expect(actual).toHaveLength(1);
      expect(actual[0][prop]).toBe(false);
    }
  );
});

describe('stateMapper', () => {
  it.each([
    { state: 'alpha', expected: PluginState.alpha },
    { state: 'beta', expected: PluginState.beta },
    { state: 'deprecated', expected: PluginState.deprecated },
    { state: 'stable', expected: PluginState.stable },
    { state: '', expected: '' },
    { state: null, expected: '' },
    { state: undefined, expected: '' },
  ])(`when called with $state then it should map to $expected`, ({ expected, state }) => {
    myOrgTestAppMeta.spec.pluginJson.state = state as v0alpha1Spec['pluginJson']['state'];
    expect(stateMapper(myOrgTestAppMeta.spec)).toStrictEqual(expected);
  });
});

describe('includeTypeMapper', () => {
  it.each([
    { include: { type: 'dashboard' }, expected: PluginIncludeType.dashboard },
    { include: { type: 'page' }, expected: PluginIncludeType.page },
    { include: { type: 'page' }, expected: PluginIncludeType.page },
    { include: { type: 'panel' }, expected: PluginIncludeType.panel },
    { include: { type: 'datasource' }, expected: PluginIncludeType.datasource },
    { include: { type: '' }, expected: '' },
    { include: { type: null }, expected: '' },
    { include: { type: undefined }, expected: '' },
  ])(`when called with $include then it should map to $expected`, ({ expected, include }) => {
    expect(includeTypeMapper(include as v0alpha1Include)).toStrictEqual(expected);
  });
});

describe('slugMapper', () => {
  it.each([
    { include: { name: 'main' }, expected: 'main' },
    { include: { name: 'Main' }, expected: 'main' },
    { include: { name: 'MainPage' }, expected: 'mainpage' },
    { include: { name: 'Main Page' }, expected: 'main-page' },
    { include: { name: 'Main Page One' }, expected: 'main-page-one' },
    { include: { name: '' }, expected: '' },
    { include: { name: null }, expected: '' },
    { include: { name: undefined }, expected: '' },
  ])(`when called with $include then it should map to $expected`, ({ expected, include }) => {
    expect(slugMapper(include as v0alpha1Include)).toStrictEqual(expected);
  });
});

describe('typeMapper', () => {
  it.each([
    { type: 'app', expected: PluginType.app },
    { type: 'datasource', expected: PluginType.datasource },
    { type: 'panel', expected: PluginType.panel },
    { type: 'renderer', expected: PluginType.renderer },
    { type: '', expected: '' },
    { type: null, expected: '' },
    { type: undefined, expected: '' },
  ])(`when called with $type then it should map to $expected`, ({ expected, type }) => {
    myOrgTestAppMeta.spec.pluginJson.type = type as v0alpha1Spec['pluginJson']['type'];
    expect(typeMapper(myOrgTestAppMeta.spec)).toStrictEqual(expected);
  });
});

describe('secureJsonFieldsMapper', () => {
  it('should set true on secureJsonFields for every key that exist in secure', () => {
    myOrgTestAppSettings.secure = {
      apiKey: { name: '<redacted>' },
      password: { name: '<redacted>' },
      noName: {} as unknown as InlineSecureValue,
      valueWithoutName: { name: undefined as unknown as string },
      noValue: undefined as unknown as InlineSecureValue,
    };

    expect(secureJsonFieldsMapper(myOrgTestAppSettings)).toStrictEqual({
      apiKey: true,
      password: true,
      noName: true,
      valueWithoutName: true,
    });
  });
});

describe('settingsSpecMapper', () => {
  it('should return empty object when no relevant fields are provided', () => {
    expect(settingsSpecMapper({})).toStrictEqual({});
  });

  it('should map enabled when provided', () => {
    expect(settingsSpecMapper({ enabled: true })).toStrictEqual({ enabled: true });
  });

  it('should map enabled false', () => {
    expect(settingsSpecMapper({ enabled: false })).toStrictEqual({ enabled: false });
  });

  it('should map pinned when provided', () => {
    expect(settingsSpecMapper({ pinned: true })).toStrictEqual({ pinned: true });
  });

  it('should map jsonData when provided', () => {
    const jsonData = { apiUrl: 'http://example.com', timeout: '30' };

    expect(settingsSpecMapper({ jsonData })).toStrictEqual({ jsonData });
  });

  it('should map all fields when all are provided', () => {
    const data = { enabled: true, pinned: false, jsonData: { key: 'value' } };

    expect(settingsSpecMapper(data)).toStrictEqual({
      enabled: true,
      pinned: false,
      jsonData: { key: 'value' },
    });
  });

  it('should ignore unrelated fields', () => {
    const data = { enabled: true, id: 'some-plugin', name: 'Some Plugin' };

    expect(settingsSpecMapper(data)).toStrictEqual({ enabled: true });
  });
});

describe('inlineSecureValuesMapper', () => {
  it('should return empty object when secureJsonData is undefined', () => {
    expect(inlineSecureValuesMapper({})).toStrictEqual({});
  });

  it('should return empty object when secureJsonData is empty', () => {
    expect(inlineSecureValuesMapper({ secureJsonData: {} })).toStrictEqual({});
  });

  it('should create new values when secureJsonFields is undefined', () => {
    expect(inlineSecureValuesMapper({ secureJsonData: { apiKey: 'secret123' } })).toStrictEqual({
      apiKey: { create: 'secret123' },
    });
  });

  it('should create new values when key does not exist in secureJsonFields', () => {
    expect(
      inlineSecureValuesMapper({
        secureJsonData: { apiKey: 'secret123' },
        secureJsonFields: { password: true },
      })
    ).toStrictEqual({
      apiKey: { create: 'secret123' },
    });
  });

  it('should remove values when key is set to false in secureJsonFields', () => {
    expect(
      inlineSecureValuesMapper({ secureJsonData: { password: '' }, secureJsonFields: { password: false } })
    ).toStrictEqual({
      password: { remove: true },
    });
  });

  it('should remove values when key is set to false in secureJsonFields even if the key does not exist in secureJsonData', () => {
    expect(inlineSecureValuesMapper({ secureJsonData: {}, secureJsonFields: { password: false } })).toStrictEqual({
      password: { remove: true },
    });
  });

  it('should update existing values when key exists in secureJsonFields', () => {
    expect(
      inlineSecureValuesMapper({
        secureJsonData: { apiKey: 'newSecret' },
        secureJsonFields: { apiKey: true },
      })
    ).toStrictEqual({
      apiKey: { name: 'newSecret' },
    });
  });

  it('should skip keys with undefined values in secureJsonData', () => {
    expect(
      inlineSecureValuesMapper({
        secureJsonData: { apiKey: 'secret', empty: undefined as unknown as string },
      })
    ).toStrictEqual({
      apiKey: { create: 'secret' },
    });
  });

  it('should handle a mix of new and existing values', () => {
    expect(
      inlineSecureValuesMapper({
        secureJsonData: { apiKey: 'newKey', password: 'newPass' },
        secureJsonFields: { apiKey: true },
      })
    ).toStrictEqual({
      apiKey: { name: 'newKey' },
      password: { create: 'newPass' },
    });
  });
});
