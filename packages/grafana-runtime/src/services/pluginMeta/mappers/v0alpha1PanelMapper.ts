import { type PanelPluginMeta, PluginType } from '@grafana/data';

import type { PanelPluginMetas, PanelPluginMetasMapper, PluginMetasResponse } from '../types';
import type { Spec as v0alpha1Spec } from '../types/meta/types.spec.gen';

import {
  angularMapper,
  combinePathAndUrl,
  isCorePlugin,
  isDecoupledCorePlugin,
  loadingStrategyMapper,
  stateMapper,
  infoMapper,
  signatureMapper,
} from './shared';

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
  const aliasIDs = spec.aliasIds;

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
    aliasIDs,
  };
}

function getPublicPath(): string {
  return typeof window !== 'undefined' && window.__grafana_public_path__ ? window.__grafana_public_path__ : '';
}

export function coreSpecMapper(spec: v0alpha1Spec): PanelPluginMeta {
  const mapped = specMapper(spec);
  const publicPath = getPublicPath();

  if (!publicPath) {
    return mapped;
  }

  return {
    ...mapped,
    baseUrl: combinePathAndUrl(publicPath, spec.baseURL),
    module: isDecoupledCorePlugin(spec) ? combinePathAndUrl(publicPath, spec.module.path) : spec.module.path,
    info: {
      ...mapped.info,
      logos: {
        ...spec.pluginJson.info.logos,
        large: combinePathAndUrl(publicPath, spec.pluginJson.info.logos.large),
        small: combinePathAndUrl(publicPath, spec.pluginJson.info.logos.small),
      },
      screenshots: spec.pluginJson.info.screenshots
        ? spec.pluginJson.info.screenshots.map((s) => ({
            ...s,
            name: s.name ?? '',
            path: combinePathAndUrl(publicPath, s.path ?? ''),
          }))
        : [],
    },
  };
}

export const v0alpha1PanelMapper: PanelPluginMetasMapper<PluginMetasResponse> = (response) => {
  const result: PanelPluginMetas = {};

  return response.items.reduce((acc, curr) => {
    if (curr.spec.pluginJson.type !== 'panel') {
      return acc;
    }

    const mapper = isCorePlugin(curr.spec) ? coreSpecMapper : specMapper;

    const config = mapper(curr.spec);
    acc[config.id] = config;
    return acc;
  }, result);
};
