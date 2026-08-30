import {
  type PluginInclude,
  PluginIncludeType,
  type KeyValue,
  PluginSignatureType,
  type PluginMeta,
} from '@grafana/data';

import {
  angularMapper,
  dependenciesMapper,
  extensionsMapper,
  infoMapper,
  loadingStrategyMapper,
  pluginTypeMapper,
  stateMapper,
  signatureStatusMapper,
} from '../../pluginMeta/mappers/shared';
import type { Include as v0alpha1Include, Spec as v0alpha1Spec } from '../../pluginMeta/types/meta/types.spec.gen';
import { logPluginSettingsWarning } from '../logging';
import {
  type Settings as v0alpha1Settings,
  type SettingsMapper,
  type SettingsSpec as v0alpha1SettingsSpec,
  type InlineSecureValues as v0alpha1InlineSecureValues,
} from '../types';

export function settingsSpecMapper(data: Partial<PluginMeta>): Partial<v0alpha1SettingsSpec> {
  const result: Partial<v0alpha1SettingsSpec> = {};

  if (data.enabled !== undefined) {
    result.enabled = data.enabled;
  }

  if (data.pinned !== undefined) {
    result.pinned = data.pinned;
  }

  if (data.jsonData !== undefined) {
    result.jsonData = data.jsonData;
  }

  return result;
}

export function inlineSecureValuesMapper(data: Partial<PluginMeta>): v0alpha1InlineSecureValues {
  const { secureJsonData = {}, secureJsonFields = {} } = data;

  const result: v0alpha1InlineSecureValues = {};

  for (const key of Object.keys(secureJsonData)) {
    const secureValue = secureJsonData[key];

    if (secureValue === undefined) {
      continue;
    }

    // Key doesn't exist on the server, so we create it in-place by sending
    // the new plaintext in `create`.
    if (secureJsonFields?.[key] === undefined) {
      result[key] = { create: secureValue };
      continue;
    }

    // Key exists on the server but is marked for deletion, so we delete it in-place by sending `remove: true`.
    if (secureJsonFields?.[key] === false) {
      result[key] = { remove: true };
      continue;
    }

    // Key already exists on the server, so we update it in-place by sending
    // the new plaintext in `name`.
    result[key] = { name: secureValue };
  }

  for (const key of Object.keys(secureJsonFields)) {
    const secureValue = secureJsonFields[key];

    // Key exists on the server but is marked for deletion, so we delete it in-place by sending `remove: true`.
    if (secureValue === false) {
      result[key] = { remove: true };
    }
  }

  return result;
}

export function secureJsonFieldsMapper(settings: v0alpha1Settings): KeyValue<boolean> {
  const secure = settings.secure ?? {};
  const secureJsonFields: KeyValue<boolean> = Object.keys(secure).reduce((acc: KeyValue<boolean>, curr) => {
    const secureValue = secure[curr];
    if (!secureValue) {
      return acc;
    }

    acc[curr] = true;
    return acc;
  }, {});

  return secureJsonFields;
}

export function includeTypeMapper(include: v0alpha1Include, spec: v0alpha1Spec): PluginIncludeType {
  if (!include.type) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return '' as PluginIncludeType;
  }

  switch (include.type) {
    case 'dashboard':
      return PluginIncludeType.dashboard;
    case 'page':
      return PluginIncludeType.page;
    case 'panel':
      return PluginIncludeType.panel;
    case 'datasource':
      return PluginIncludeType.datasource;
    default:
      logPluginSettingsWarning(`includeTypeMapper: unknown PluginIncludeType ${include.type}`, {
        pluginId: spec.pluginJson.id,
        pluginType: spec.pluginJson.type,
        includeType: include.type,
      });
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return '' as PluginIncludeType;
  }
}

export function slugMapper(include: v0alpha1Include): string {
  const name = include.name ?? '';
  return name
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
}

export function includesMapper(spec: v0alpha1Spec): PluginInclude[] {
  const includes = spec.pluginJson.includes ?? [];
  return includes.map((i) => ({
    ...i,
    name: i.name ?? '',
    type: includeTypeMapper(i, spec),
    addToNav: i.addToNav ?? false,
    component: i.component ?? '',
    defaultNav: i.defaultNav ?? false,
    icon: i.icon ?? '',
    path: i.path ?? '',
    role: i.role ?? '',
    uid: i.uid ?? '',
    slug: slugMapper(i),
  }));
}

export function signatureTypeMapper(spec: v0alpha1Spec): PluginSignatureType {
  if (!spec.signature.type) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (spec.signature.type ?? '') as PluginSignatureType;
  }

  switch (spec.signature.type) {
    case 'commercial':
      return PluginSignatureType.commercial;
    case 'community':
      return PluginSignatureType.community;
    case 'grafana':
      return PluginSignatureType.grafana;
    case 'private':
      return PluginSignatureType.private;
    default:
      logPluginSettingsWarning(`signatureTypeMapper: unknown PluginSignatureType ${spec.signature.type}`, {
        pluginId: spec.pluginJson.id,
        pluginType: spec.pluginJson.type,
        signatureType: spec.signature.type,
      });
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return '' as PluginSignatureType;
  }
}

function v0alpha1SpecMapper(spec: v0alpha1Spec) {
  const { aliasIds: aliasIDs, baseURL: baseUrl } = spec;
  const { id, name } = spec.pluginJson;
  const { org: signatureOrg = '' } = spec.signature;
  const { path: module, hash: moduleHash } = spec.module;
  const autoEnabled = spec.pluginJson.autoEnabled ?? false;
  const hasUpdate = false;
  const latestVersion = '';
  const type = pluginTypeMapper(spec, logPluginSettingsWarning);
  const info = infoMapper(spec);
  const angular = angularMapper(spec);
  const angularDetected = false;
  const dependencies = dependenciesMapper(spec, logPluginSettingsWarning);
  const extensions = extensionsMapper(spec);
  const includes = includesMapper(spec);
  const loadingStrategy = loadingStrategyMapper(spec);
  const signature = signatureStatusMapper(spec, logPluginSettingsWarning);
  const signatureType = signatureTypeMapper(spec);
  const state = stateMapper(spec, logPluginSettingsWarning);

  return {
    autoEnabled,
    baseUrl,
    hasUpdate,
    id,
    info,
    latestVersion,
    module,
    name,
    type,
    aliasIDs,
    angular,
    angularDetected,
    dependencies,
    extensions,
    includes,
    loadingStrategy,
    moduleHash,
    signature,
    signatureOrg,
    signatureType,
    state,
  };
}

export const v0alpha1SettingsMapper: SettingsMapper = (spec, settings) => {
  const specMappings = v0alpha1SpecMapper(spec);

  if (spec.pluginJson.type === 'app' && settings) {
    const { enabled, jsonData, pinned } = settings.spec;
    const secureJsonFields = secureJsonFieldsMapper(settings);

    return {
      ...specMappings,
      enabled: specMappings.autoEnabled ? true : enabled,
      jsonData,
      pinned: specMappings.autoEnabled ? true : pinned,
      secureJsonFields,
    };
  }

  return {
    ...specMappings,
    enabled: false,
    pinned: false,
    jsonData: {},
    secureJsonFields: {},
  };
};
