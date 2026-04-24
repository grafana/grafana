import {
  type PluginInclude,
  PluginIncludeType,
  PluginType,
  type KeyValue,
  PluginSignatureType,
  locationUtil,
  type PluginMeta,
} from '@grafana/data';

import {
  angularMapper,
  dependenciesMapper,
  extensionsMapper,
  infoMapper,
  loadingStrategyMapper,
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

export function typeMapper(spec: v0alpha1Spec): PluginType {
  if (!spec.pluginJson.type) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return '' as PluginType;
  }

  switch (spec.pluginJson.type) {
    case 'app':
      return PluginType.app;
    case 'datasource':
      return PluginType.datasource;
    case 'panel':
      return PluginType.panel;
    case 'renderer':
      return PluginType.renderer;
  }
}

export function includeTypeMapper(include: v0alpha1Include): PluginIncludeType {
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
    type: includeTypeMapper(i),
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
      logPluginSettingsWarning(
        `signatureTypeMapper: unknown PluginSignatureType ${spec.signature.type}`,
        spec.pluginJson.id
      );
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (spec.signature.type ?? '') as PluginSignatureType;
  }
}

function getDefaultNavUrlForDashboard(include: v0alpha1Include): string | undefined {
  if (include.type !== 'dashboard') {
    return undefined;
  }

  if (!include.uid) {
    return undefined;
  }

  return locationUtil.assureBaseUrl(`/d/${include.uid}`);
}

export function defaultNavUrlMapper(spec: v0alpha1Spec): string | undefined {
  const defaultInclude = spec.pluginJson.includes?.find((i) => i.defaultNav);
  if (!defaultInclude) {
    return undefined;
  }

  if (defaultInclude.type === 'page') {
    const slug = slugMapper(defaultInclude);
    return locationUtil.assureBaseUrl(`/plugins/${spec.pluginJson.id}/page/${slug}`);
  }

  return getDefaultNavUrlForDashboard(defaultInclude);
}

export const v0alpha1SettingsMapper: SettingsMapper = (spec, settings) => {
  const { aliasIds: aliasIDs, baseURL: baseUrl } = spec;
  const { id, name } = spec.pluginJson;
  const { org: signatureOrg = '' } = spec.signature;
  const { path: module, hash: moduleHash } = spec.module;
  const { enabled, jsonData, pinned } = settings.spec;
  const autoEnabled = false;
  const hasUpdate = false;
  const latestVersion = '';
  const secureJsonFields = secureJsonFieldsMapper(settings);
  const type = typeMapper(spec);
  const info = infoMapper(spec);
  const angular = angularMapper(spec);
  const angularDetected = false;
  const dependencies = dependenciesMapper(spec);
  const extensions = extensionsMapper(spec);
  const includes = includesMapper(spec);
  const loadingStrategy = loadingStrategyMapper(spec);
  const signature = signatureStatusMapper(spec);
  const signatureType = signatureTypeMapper(spec);
  const state = stateMapper(spec);
  const defaultNavUrl = defaultNavUrlMapper(spec);

  return {
    autoEnabled,
    baseUrl,
    defaultNavUrl,
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
    enabled,
    extensions,
    includes,
    jsonData,
    loadingStrategy,
    moduleHash,
    pinned,
    secureJsonFields,
    signature,
    signatureOrg,
    signatureType,
    state,
  };
};
