import { type TimeRange, dateTime } from '@grafana/data';
import {
  LabelsApiClient,
  type PromMetricsMetadata,
  type PrometheusDatasource,
  type PrometheusLanguageProviderInterface,
  type ResourceApiClient,
} from '@grafana/prometheus';
import { type BackendSrvRequest } from '@grafana/runtime';

import { type ResourcesAPI } from '../../../resources/ResourcesAPI';

export class CloudWatchPromQLLanguageProvider implements PrometheusLanguageProviderInterface {
  private client: ResourceApiClient;
  datasource: PrometheusDatasource;
  resources: ResourcesAPI;
  region: string;

  constructor(datasource: PrometheusDatasource, resources: ResourcesAPI, region: string) {
    this.datasource = datasource;
    this.resources = resources;
    this.region = region;
    this.client = new LabelsApiClient(this.request, this.datasource);
  }

  /** Switches region and rebuilds the client (its cache is not keyed by region). */
  updateRegion = (newRegion: string) => {
    this.region = newRegion;
    this.client = new LabelsApiClient(this.request, this.datasource);
  };

  /**
   * Initializes the language provider by fetching metrics and label keys.
   * When no timeRange is provided, we use the default time range (now-6h/now).
   */
  start = async (timeRange?: TimeRange): Promise<unknown[]> => {
    const range: TimeRange = timeRange ?? {
      from: dateTime().subtract(6, 'hours'),
      to: dateTime(),
      raw: { from: 'now-6h', to: 'now' },
    };
    await this.client.start(range);
    return [];
  };

  /** Returns the cached label keys (empty until a query/start has run). */
  retrieveLabelKeys = (): string[] => {
    return this.client.labelKeys;
  };

  /** Returns the cached metric names (empty until a query/start has run). */
  retrieveMetrics = (): string[] => {
    return this.client.metrics;
  };

  /** Returns the cached histogram metric names (those ending in _bucket). */
  retrieveHistogramMetrics = (): string[] => {
    return this.client.histogramMetrics;
  };

  /** Returns cached metric metadata. CloudWatch has no /api/v1/metadata endpoint, so this is always empty. */
  retrieveMetricsMetadata = (): PromMetricsMetadata => {
    return {};
  };

  /** Fetches label keys for the time range, optionally filtered by match/limit. */
  queryLabelKeys = (timeRange: TimeRange, match?: string, limit?: number): Promise<string[]> => {
    return this.client.queryLabelKeys(timeRange, match, limit);
  };

  /** Fetches values for a label key, optionally filtered by match/limit. */
  queryLabelValues = (timeRange: TimeRange, labelKey: string, match?: string, limit?: number): Promise<string[]> => {
    return this.client.queryLabelValues(timeRange, labelKey, match, limit);
  };

  /** Fetches metric metadata. CloudWatch has no /api/v1/metadata endpoint, so this is always empty. */
  queryMetricsMetadata = async (_limit?: number): Promise<PromMetricsMetadata> => {
    return {};
  };

  /**
   * Adapts @grafana/prometheus resource clients to CloudWatch's managed PromQL endpoint.
   * The clients issue Prometheus-style label requests; we map them onto CloudWatch's
   * resource API. Anything else returns an empty array.
   */
  request = async (
    url: string,
    params?: Record<string, unknown>,
    _options?: Partial<BackendSrvRequest>
  ): Promise<unknown> => {
    const LABELS_ENDPOINT = '/api/v1/labels';
    const LABEL_VALUES_ENDPOINT = /^\/api\/v1\/label\/(.+)\/values$/;

    const options = params ?? {};
    const start = options.start != null ? Number(options.start) : undefined;
    const end = options.end != null ? Number(options.end) : undefined;
    const limit = options.limit != null ? Number(options.limit) : undefined;
    const match = typeof options['match[]'] === 'string' ? options['match[]'] : undefined;

    if (url === LABELS_ENDPOINT) {
      return this.resources.getPromQLLabelKeys(this.region, match, start, end, limit).catch(() => []);
    }

    const valuesMatch = LABEL_VALUES_ENDPOINT.exec(url);
    if (valuesMatch) {
      const labelKey = decodeURIComponent(valuesMatch[1]);
      return this.resources.getPromQLLabelValues(this.region, labelKey, match, start, end, limit).catch(() => []);
    }

    return [];
  };

  /** CloudWatch has no suggestions endpoint; always returns an empty list. */
  fetchSuggestions = async (
    _timeRange?: unknown,
    _queries?: unknown,
    _scopes?: unknown,
    _adhocFilters?: unknown,
    _labelName?: string,
    _limit?: number,
    _requestId?: string
  ): Promise<string[]> => {
    return [];
  };
}
