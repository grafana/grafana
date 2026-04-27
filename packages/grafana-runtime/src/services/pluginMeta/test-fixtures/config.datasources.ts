/* eslint-disable @grafana/no-restricted-img-srcs */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {
  type AngularMeta,
  type DataSourcePluginMeta,
  PluginLoadingStrategy,
  PluginSignatureStatus,
  PluginType,
} from '@grafana/data';

import type { DatasourcePluginMetas } from '../types';

export const prometheusMeta: DataSourcePluginMeta = structuredClone({
  id: 'prometheus',
  name: 'Prometheus',
  info: {
    author: {
      name: 'Grafana Labs',
      url: 'https://grafana.com',
    },
    description: 'Open source time series database & alerting',
    links: [],
    logos: {
      small: 'public/app/plugins/datasource/prometheus/img/prometheus_logo.svg',
      large: 'public/app/plugins/datasource/prometheus/img/prometheus_logo.svg',
    },
    build: {},
    screenshots: [],
    version: '1.0.0',
    updated: '2026-01-26',
    keywords: ['prometheus'],
  },
  baseUrl: 'public/app/plugins/datasource/prometheus',
  signature: PluginSignatureStatus.internal,
  module: 'public/app/plugins/datasource/prometheus/module.js',
  angular: { detected: false } as AngularMeta,
  loadingStrategy: PluginLoadingStrategy.script,
  type: PluginType.datasource,
  metrics: true,
  alerting: true,
  backend: true,
  streaming: true,
});

export const lokiMeta: DataSourcePluginMeta = structuredClone({
  id: 'loki',
  name: 'Loki',
  info: {
    author: {
      name: 'Grafana Labs',
      url: 'https://grafana.com',
    },
    description: 'Like Prometheus, but for logs',
    links: [],
    logos: {
      small: 'public/app/plugins/datasource/loki/img/loki_icon.svg',
      large: 'public/app/plugins/datasource/loki/img/loki_icon.svg',
    },
    build: {},
    screenshots: [],
    version: '1.0.0',
    updated: '2026-01-26',
    keywords: ['loki'],
  },
  baseUrl: 'public/app/plugins/datasource/loki',
  signature: PluginSignatureStatus.internal,
  module: 'public/app/plugins/datasource/loki/module.js',
  angular: { detected: false } as AngularMeta,
  loadingStrategy: PluginLoadingStrategy.script,
  type: PluginType.datasource,
  logs: true,
  backend: true,
});

export const datasourcePluginMetas: DatasourcePluginMetas = {
  prometheus: prometheusMeta,
  loki: lokiMeta,
};
