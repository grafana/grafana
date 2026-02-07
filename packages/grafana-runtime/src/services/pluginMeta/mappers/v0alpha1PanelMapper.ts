import {
  type PanelPluginMeta,
  type PluginMetaInfo,
  PluginSignatureStatus,
  PluginState,
  PluginType,
} from '@grafana/data';

import type { PanelPluginMetas, PanelPluginMetasMapper, PluginMetasResponse } from '../types';
import type { Spec as v0alpha1Spec } from '../types/types.spec.gen';

import { angularMapper, loadingStrategyMapper } from './shared';

function toCDNUrl(spec: v0alpha1Spec, path: string): string {
  try {
    const normalizedBase = spec.baseURL.endsWith('/') ? spec.baseURL : `${spec.baseURL}/`;
    const url = new URL(path, normalizedBase);
    return url.toString();
  } catch (error) {
    return path; // plugin without proper CDN URL or builtin plugin
  }
}

function screenshotsMapper(spec: v0alpha1Spec): PluginMetaInfo['screenshots'] {
  if (!spec.pluginJson.info.screenshots) {
    return [];
  }

  return spec.pluginJson.info.screenshots.map((s) => ({
    ...s,
    name: s.name ?? '',
    path: toCDNUrl(spec, s.path ?? ''),
  }));
}

function logosMapper(spec: v0alpha1Spec): PluginMetaInfo['logos'] {
  return {
    ...spec.pluginJson.info.logos,
    large: toCDNUrl(spec, spec.pluginJson.info.logos.large),
    small: toCDNUrl(spec, spec.pluginJson.info.logos.small),
  };
}

function infoMapper(spec: v0alpha1Spec): PluginMetaInfo {
  const { updated, version, description = '', keywords } = spec.pluginJson.info;
  const author = { ...spec.pluginJson.info.author, name: spec.pluginJson.info.author?.name ?? '' };
  const links = (spec.pluginJson.info.links || []).map((l) => ({ ...l, name: l.name ?? '', url: l.url ?? '' }));
  const screenshots = screenshotsMapper(spec);
  const build = {};
  const logos = logosMapper(spec);

  return {
    author,
    description,
    links,
    logos,
    build,
    screenshots,
    updated,
    version,
    keywords,
  };
}

function stateMapper(spec: v0alpha1Spec): PluginState | undefined {
  const state = spec.pluginJson.state;

  if (state === PluginState.alpha) {
    return PluginState.alpha;
  }

  if (state === PluginState.beta) {
    return PluginState.beta;
  }

  if (state === PluginState.deprecated) {
    return PluginState.deprecated;
  }

  if (state === PluginState.stable) {
    return PluginState.stable;
  }

  return;
}

const idToSortMap: Record<string, number> = {
  timeseries: 1,
  barchart: 2,
  stat: 3,
  gauge: 4,
  bargauge: 5,
  table: 6,
  singlestat: 7,
  piechart: 8,
  'state-timeline': 9,
  heatmap: 10,
  'status-history': 11,
  histogram: 12,
  graph: 13,
  text: 14,
  alertlist: 15,
  dashlist: 16,
  news: 17,
};

function sortMapper(spec: v0alpha1Spec): number {
  return idToSortMap[spec.pluginJson.id] ?? 100;
}

function signatureMapper(spec: v0alpha1Spec): PluginSignatureStatus | undefined {
  const signature = spec.signature?.status;
  if (!signature) {
    return;
  }

  if (signature === PluginSignatureStatus.internal) {
    return PluginSignatureStatus.internal;
  }

  if (signature === PluginSignatureStatus.invalid) {
    return PluginSignatureStatus.invalid;
  }

  if (signature === PluginSignatureStatus.modified) {
    return PluginSignatureStatus.modified;
  }

  if (signature === PluginSignatureStatus.valid) {
    return PluginSignatureStatus.valid;
  }

  return;
}

function specMapper(spec: v0alpha1Spec): PanelPluginMeta {
  const { id, name, hideFromList = false, skipDataQuery = false, suggestions } = spec.pluginJson;
  const state = stateMapper(spec);
  const info = infoMapper(spec);
  const loadingStrategy = loadingStrategyMapper(spec);
  const sort = sortMapper(spec);
  const type = PluginType.panel;
  const module = spec.module.path;
  const baseUrl = spec.baseURL;
  const signature = signatureMapper(spec);
  const angular = angularMapper(spec);
  const translations = spec.translations;
  const moduleHash = spec.module.hash;

  return {
    id,
    name,
    info,
    hideFromList,
    sort,
    skipDataQuery,
    suggestions,
    state,
    baseUrl,
    signature,
    module,
    angular,
    loadingStrategy,
    type,
    translations,
    moduleHash,
  };
}

export const v0alpha1PanelMapper: PanelPluginMetasMapper<PluginMetasResponse> = (response) => {
  const result: PanelPluginMetas = {};

  return response.items.reduce((acc, curr) => {
    if (curr.spec.pluginJson.type !== 'panel') {
      return acc;
    }

    const config = specMapper(curr.spec);
    acc[config.id] = config;
    return acc;
  }, result);
};
