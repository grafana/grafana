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

/**
 * Returns the spec to store when `data` is applied to `stored`, with the semantics of the legacy
 * `POST /api/plugins/:id/settings` endpoint: an empty or omitted `jsonData` keeps the stored one,
 * and `pinned` is never stored. An omitted `enabled` keeps the stored value (legacy set `false`).
 */
export function settingsSpecMapper(stored: v0alpha1SettingsSpec, data: Partial<PluginMeta>): v0alpha1SettingsSpec {
  const result: v0alpha1SettingsSpec = { ...stored };

  if (data.enabled !== undefined) {
    result.enabled = data.enabled;
  }

  // Compare what the legacy endpoint receives: the JSON body drops undefined values, so
  // `{ key: undefined }` is sent as `{}` and keeps the stored jsonData.
  const jsonData: unknown = data.jsonData === undefined ? undefined : JSON.parse(JSON.stringify(data.jsonData));
  if (isNonEmptyObject(jsonData)) {
    result.jsonData = jsonData;
  }

  return result;
}

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0;
}

/**
 * Returns the secure values to store when `data` is applied to `stored`. Keys the caller omits keep
 * their stored value, as with the legacy endpoint. A non-empty value in `secureJsonData` replaces the
 * stored one. An empty string (how legacy callers reset a secret) removes a stored key, and so does
 * `secureJsonFields[key] === false` when no new value is passed.
 */
export function inlineSecureValuesMapper(
  stored: v0alpha1InlineSecureValues | undefined,
  data: Partial<PluginMeta>
): v0alpha1InlineSecureValues {
  const { secureJsonData = {}, secureJsonFields = {} } = data;
  const result: v0alpha1InlineSecureValues = { ...stored };

  const remove = (key: string) => {
    // Removing a key the server doesn't have is a no-op, so leave it out of the update.
    if (stored?.[key]) {
      result[key] = { remove: true };
    } else {
      delete result[key];
    }
  };

  for (const key of Object.keys(secureJsonData)) {
    const secureValue = secureJsonData[key];

    if (secureValue === undefined) {
      continue;
    }

    if (secureValue === '') {
      remove(key);
      continue;
    }

    // New plaintext always goes in `create`, whether or not the key already exists on the server.
    // A `name` on write references an existing secure value, so the server would keep the old value.
    result[key] = { create: secureValue };
  }

  for (const key of Object.keys(secureJsonFields)) {
    // A form that resets a secret and then gets a new value still has `false` here.
    if (secureJsonFields[key] === false && !secureJsonData[key]) {
      remove(key);
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
