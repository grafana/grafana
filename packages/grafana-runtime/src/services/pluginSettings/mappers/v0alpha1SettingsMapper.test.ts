import {
  type GrafanaConfig,
  locationUtil,
  PluginIncludeType,
  PluginLoadingStrategy,
  PluginSignatureStatus,
  PluginSignatureType,
  PluginState,
  type PluginMeta,
  PluginType,
} from '@grafana/data';

import { setLogger } from '../../logging/registry';
import { signatureStatusMapper, stateMapper, pluginTypeMapper } from '../../pluginMeta/mappers/shared';
import { myOrgTestAppMeta } from '../../pluginMeta/test-fixtures/v0alpha1Response';
import type { Include as v0alpha1Include, Spec as v0alpha1Spec } from '../../pluginMeta/types/meta/types.spec.gen';
import { myOrgTestAppSettings } from '../test-fixtures/v0alpha1Response';
import { type InlineSecureValue, type InlineSecureValues, type SettingsSpec } from '../types';

import {
  includesMapper,
  includeTypeMapper,
  inlineSecureValuesMapper,
  secureJsonFieldsMapper,
  settingsSpecMapper,
  signatureTypeMapper,
  slugMapper,
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
    expect(v0alpha1SettingsMapper(myOrgTestAppMeta.spec, myOrgTestAppSettings).defaultNavUrl).toBeUndefined();
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

  it('should map enabled to true when autoEnabled is set to true', () => {
    const updatedSpec = {
      ...myOrgTestAppMeta.spec,
      pluginJson: { ...myOrgTestAppMeta.spec.pluginJson, autoEnabled: true },
    };
    const updatedSettings = {
      ...myOrgTestAppSettings,
      spec: {
        ...myOrgTestAppSettings.spec,
        enabled: false,
      },
    };

    expect(v0alpha1SettingsMapper(updatedSpec, updatedSettings).enabled).toBe(true);
  });

  it('preserves declared skills in plugin settings', () => {
    const spec = {
      ...myOrgTestAppMeta.spec,
      pluginJson: {
        ...myOrgTestAppMeta.spec.pluginJson,
        extensions: {
          skills: { 'investigate-errors': { path: 'skills/investigate-errors/SKILL.md' } },
        },
      },
    };

    expect(v0alpha1SettingsMapper(spec, myOrgTestAppSettings).extensions?.skills).toEqual({
      'investigate-errors': { path: 'skills/investigate-errors/SKILL.md' },
    });
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

  it('should map pinned to true when autoEnabled is set to true', () => {
    const updatedSpec = {
      ...myOrgTestAppMeta.spec,
      pluginJson: { ...myOrgTestAppMeta.spec.pluginJson, autoEnabled: true },
    };
    const updatedSettings = {
      ...myOrgTestAppSettings,
      spec: {
        ...myOrgTestAppSettings.spec,
        pinned: false,
      },
    };

    expect(v0alpha1SettingsMapper(updatedSpec, updatedSettings).enabled).toBe(true);
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

describe('signatureTypeMapper', () => {
  it.each([
    { type: 'commercial', expected: PluginSignatureType.commercial },
    { type: 'community', expected: PluginSignatureType.community },
    { type: 'grafana', expected: PluginSignatureType.grafana },
    { type: 'private', expected: PluginSignatureType.private },
    { type: 'private-glob', expected: '' },
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
    { status: '', expected: 'unsigned' },
    { status: null, expected: 'unsigned' },
    { status: undefined, expected: 'unsigned' },
  ])(`when called with $status then it should map to $expected`, ({ expected, status }) => {
    myOrgTestAppMeta.spec.signature.status = status as v0alpha1Spec['signature']['status'];
    expect(signatureStatusMapper(myOrgTestAppMeta.spec, () => {})).toStrictEqual(expected);
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
    expect(stateMapper(myOrgTestAppMeta.spec, () => {})).toStrictEqual(expected);
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
    expect(includeTypeMapper(include as v0alpha1Include, myOrgTestAppMeta.spec)).toStrictEqual(expected);
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
    expect(pluginTypeMapper(myOrgTestAppMeta.spec, () => {})).toStrictEqual(expected);
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
  const stored = { enabled: true, pinned: true, jsonData: { a: 1, b: 2 } };

  it.each<{ desc: string; data: Partial<PluginMeta>; expected: Partial<SettingsSpec> }>([
    { desc: 'keeps the stored spec when nothing is passed', data: {}, expected: stored },
    {
      desc: 'keeps the stored enabled when enabled is omitted',
      data: { jsonData: { a: 2 } },
      expected: { enabled: true, pinned: true, jsonData: { a: 2 } },
    },
    {
      desc: 'sets enabled false when passed',
      data: { enabled: false },
      expected: { enabled: false, pinned: true, jsonData: { a: 1, b: 2 } },
    },
    {
      desc: 'replaces jsonData as a whole',
      data: { jsonData: { c: 3 } },
      expected: { enabled: true, pinned: true, jsonData: { c: 3 } },
    },
    { desc: 'keeps the stored jsonData when jsonData is empty', data: { jsonData: {} }, expected: stored },
    {
      desc: 'keeps the stored jsonData when jsonData only has undefined values',
      data: { jsonData: { optional: undefined } },
      expected: stored,
    },
    {
      desc: 'drops undefined values from a replaced jsonData',
      data: { jsonData: { c: 3, optional: undefined } },
      expected: { enabled: true, pinned: true, jsonData: { c: 3 } },
    },
    { desc: 'ignores pinned', data: { pinned: false }, expected: stored },
    { desc: 'ignores unrelated fields', data: { id: 'some-plugin', name: 'Some Plugin' }, expected: stored },
  ])('$desc', ({ data, expected }) => {
    expect(settingsSpecMapper(stored, data)).toStrictEqual(expected);
  });

  it('returns only the passed fields when nothing is stored', () => {
    expect(settingsSpecMapper(undefined, { enabled: true, pinned: true, jsonData: { a: 1 } })).toStrictEqual({
      enabled: true,
      jsonData: { a: 1 },
    });
  });
});

describe('inlineSecureValuesMapper', () => {
  const stored = { apiKey: { name: 'sv-apiKey' }, password: { name: 'sv-password' } };

  it.each<{ desc: string; data: Partial<PluginMeta>; expected: InlineSecureValues }>([
    { desc: 'keeps stored values when nothing is passed', data: {}, expected: stored },
    {
      desc: 'keeps stored values when secureJsonFields marks them as set',
      data: { secureJsonFields: { apiKey: true, password: true } },
      expected: stored,
    },
    {
      desc: 'sends new plaintext as create and keeps the other stored values',
      data: { secureJsonData: { apiKey: 'new' } },
      expected: { apiKey: { create: 'new' }, password: { name: 'sv-password' } },
    },
    {
      desc: 'sends a value for a new key as create',
      data: { secureJsonData: { token: 'new' } },
      expected: { ...stored, token: { create: 'new' } },
    },
    {
      desc: 'removes a stored key when its value is an empty string',
      data: { secureJsonData: { apiKey: '' } },
      expected: { apiKey: { remove: true }, password: { name: 'sv-password' } },
    },
    {
      desc: 'removes a stored key when secureJsonFields is false',
      data: { secureJsonFields: { apiKey: false } },
      expected: { apiKey: { remove: true }, password: { name: 'sv-password' } },
    },
    {
      desc: 'creates a new value entered after a reset even when secureJsonFields is false',
      data: { secureJsonData: { apiKey: 'new' }, secureJsonFields: { apiKey: false } },
      expected: { apiKey: { create: 'new' }, password: { name: 'sv-password' } },
    },
    {
      desc: 'removes a stored key when secureJsonFields is false and the value is an empty string',
      data: { secureJsonData: { apiKey: '' }, secureJsonFields: { apiKey: false } },
      expected: { apiKey: { remove: true }, password: { name: 'sv-password' } },
    },
    {
      desc: 'skips removing a key that is not stored',
      data: { secureJsonData: { token: '' }, secureJsonFields: { other: false } },
      expected: stored,
    },
    {
      desc: 'skips keys with undefined values',
      data: { secureJsonData: { apiKey: undefined as unknown as string } },
      expected: stored,
    },
  ])('$desc', ({ data, expected }) => {
    expect(inlineSecureValuesMapper(stored, data)).toStrictEqual(expected);
  });

  it('returns only new values when nothing is stored', () => {
    expect(
      inlineSecureValuesMapper(undefined, { secureJsonData: { apiKey: 'new', password: '' }, secureJsonFields: {} })
    ).toStrictEqual({ apiKey: { create: 'new' } });
  });
});
