import {
  DataSourceApi,
  DataSourceGetTagKeysOptions,
  DataSourceGetTagValuesOptions,
  MetricFindValue,
} from '@grafana/data';
import { PrometheusDatasource, PromMetricsMetadata, PromMetricsMetadataItem, PromQuery } from '@grafana/prometheus';
import PromQlLanguageProvider from '@grafana/prometheus/src/language_provider';
import { getDataSourceSrv } from '@grafana/runtime';

import { DataTrail } from '../DataTrail';
import { VAR_DATASOURCE_EXPR } from '../shared';

export class MetricDatasourceHelper {
  constructor(trail: DataTrail) {
    this._trail = trail;
  }

  public reset() {
    this._datasource = undefined;
    this._metricsMetadata = undefined;
  }

  private _trail: DataTrail;

  private _datasource?: Promise<DataSourceApi>;

  private async getDatasource() {
    if (!this._datasource) {
      this._datasource = getDataSourceSrv().get(VAR_DATASOURCE_EXPR, { __sceneObject: { value: this._trail } });
    }

    const ds = await this._datasource;
    return ds;
  }

  _metricsMetadata?: Promise<PromMetricsMetadata | undefined>;

  private async _getMetricsMetadata() {
    const ds = await this.getDatasource();

    if (ds.languageProvider instanceof PromQlLanguageProvider) {
      if (!ds.languageProvider.metricsMetadata) {
        await ds.languageProvider.loadMetricsMetadata();
      }

      return ds.languageProvider.metricsMetadata!;
    }
    return undefined;
  }

  public async getMetricMetadata(metric?: string) {
    if (!metric) {
      return undefined;
    }
    if (!this._metricsMetadata) {
      this._metricsMetadata = this._getMetricsMetadata();
    }

    const metadata = await this._metricsMetadata;
    return metadata?.[metric];
  }

  /**
   * Used for additional filtering for adhoc vars labels in Explore metrics.
   * @param options
   * @returns
   */
  public async getTagKeys(options: DataSourceGetTagKeysOptions<PromQuery>): Promise<MetricFindValue[]> {
    const ds = await this.getDatasource();

    if (ds instanceof PrometheusDatasource) {
      const keys = await ds.getTagKeys(options);
      return keys;
    }

    return [];
  }

  /**
   * Used for additional filtering for adhoc vars label values in Explore metrics.
   * @param options
   * @returns
   */
  public async getTagValues(options: DataSourceGetTagValuesOptions<PromQuery>) {
    const ds = await this.getDatasource();

    if (ds instanceof PrometheusDatasource) {
      const keys = await ds.getTagValues(options);
      return keys;
    }

    return [];
  }
}

export function getMetricDescription(metadata?: PromMetricsMetadataItem) {
  if (!metadata) {
    return undefined;
  }

  const { type, help, unit } = metadata;

  const lines = [
    help, //
    type && `**Type:** *${type}*`,
    unit && `**Unit:** ${unit}`,
  ];

  return lines.join('\n\n');
}
