import { DataSourceApi } from '@grafana/data';
import { PromMetricsMetadata, PromMetricsMetadataItem } from '@grafana/prometheus';
import { getDataSourceSrv } from '@grafana/runtime';

import PrometheusLanguageProvider from '../../../plugins/datasource/prometheus/language_provider';
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

  private _metricsMetadata?: Promise<PromMetricsMetadata | undefined>;

  private async _getMetricsMetadata() {
    const ds = await this.getDatasource();

    if (ds.languageProvider instanceof PrometheusLanguageProvider) {
      if (!ds.languageProvider.metricsMetadata) {
        await ds.languageProvider.start();
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
