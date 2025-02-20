import {
  DataSourceApi,
  DataSourceGetTagKeysOptions,
  DataSourceGetTagValuesOptions,
  MetricFindValue,
} from '@grafana/data';
import {
  PrometheusDatasource,
  PromMetricsMetadata,
  PromMetricsMetadataItem,
  PromQlLanguageProvider,
  PromQuery,
} from '@grafana/prometheus';
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
    this._classicHistograms = {};
    this._nativeHistograms = [];
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
  // store metadata in a more easily accessible form
  _metricsMetadata?: PromMetricsMetadata | undefined;

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
      this._metricsMetadata = await this._getMetricsMetadata();
    }

    const metadata = await this._metricsMetadata;
    return metadata?.[metric];
  }

  private _classicHistograms: Record<string, number> = {};
  private _nativeHistograms: string[] = [];

  public listNativeHistograms() {
    return this._nativeHistograms;
  }

  /**
   * Identify native histograms by 2 strategies.
   * 1. querying classic histograms and all metrics,
   * then comparing the results and build the collection of native histograms.
   * 2. querying all metrics and checking if the metric is a histogram type and dies not have the bucket suffix.
   *
   * classic histogram = test_metric_bucket
   * native histogram = test_metric
   */
  public async initializeHistograms() {
    const ds = await this.getDatasource();
    if (Object.keys(this._classicHistograms).length === 0 && ds instanceof PrometheusDatasource) {
      const classicHistogramsCall = ds.metricFindQuery('metrics(.*_bucket)');
      const allMetricsCall = ds.metricFindQuery('metrics(.*)');

      const [classicHistograms, allMetrics] = await Promise.all([classicHistogramsCall, allMetricsCall]);

      classicHistograms.forEach((m) => {
        this._classicHistograms[m.text] = 1;
      });

      if (ds.languageProvider instanceof PromQlLanguageProvider) {
        if (!this._metricsMetadata && !ds.languageProvider.metricsMetadata) {
          await ds.languageProvider.loadMetricsMetadata();
          this._metricsMetadata = ds.languageProvider.metricsMetadata;
        }
      }

      allMetrics.forEach((m) => {
        if (this.isNativeHistogram(m.text)) {
          // Build the collection of native histograms.
          this.addNativeHistogram(m.text);
        }
      });
    }
  }

  /**
   * Identify native histograms by 2 strategies.
   * 1. querying classic histograms and all metrics,
   * then comparing the results and build the collection of native histograms.
   * 2. querying all metrics and checking if the metric is a histogram type and dies not have the bucket suffix.
   *
   * classic histogram = test_metric_bucket
   * native histogram = test_metric
   *
   * @param metric
   * @returns boolean
   */
  public isNativeHistogram(metric: string): boolean {
    if (!metric) {
      return false;
    }

    // check when fully migrated, we only have metadata, and there are no more classic histograms
    const metadata = this._metricsMetadata;
    // suffix is not 'bucket' and type is histogram
    const suffix: string = metric.split('_').pop() ?? '';
    // the string is not equal to bucket
    const notClassic = suffix !== 'bucket';
    if (metadata && metadata[metric] && metadata[metric].type === 'histogram' && notClassic) {
      return true;
    }

    // check for comparison when there is overlap between native and classic histograms
    if (this._classicHistograms[`${metric}_bucket`]) {
      return true;
    }

    return false;
  }

  private addNativeHistogram(metric: string) {
    if (!this._nativeHistograms.includes(metric)) {
      this._nativeHistograms.push(metric);
    }
  }

  /**
   * Used for additional filtering for adhoc vars labels in Metrics Drilldown.
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
   * Used for additional filtering for adhoc vars label values in Metrics Drilldown.
   * @param options
   * @returns
   */
  public async getTagValues(options: DataSourceGetTagValuesOptions<PromQuery>) {
    const ds = await this.getDatasource();

    if (ds instanceof PrometheusDatasource) {
      options.key = unwrapQuotes(options.key);
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

function unwrapQuotes(value: string): string {
  if (value === '' || !isWrappedInQuotes(value)) {
    return value;
  }
  return value.slice(1, -1);
}

function isWrappedInQuotes(value: string): boolean {
  const wrappedInQuotes = /^".*"$/;
  return wrappedInQuotes.test(value);
}
