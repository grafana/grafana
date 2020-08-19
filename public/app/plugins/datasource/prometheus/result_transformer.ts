import _ from 'lodash';
import TableModel from 'app/core/table_model';
import { TimeSeries, FieldType, Labels, formatLabels, QueryResultMeta } from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';

export class ResultTransformer {
  constructor(private templateSrv: TemplateSrv) {}

  transform(response: any, options: any): Array<TableModel | TimeSeries> {
    const prometheusResult = response.data.data.result;

    if (options.format === 'table') {
      return [
        this.transformMetricDataToTable(
          prometheusResult,
          options.responseListLength,
          options.refId,
          options.meta,
          options.valueWithRefId
        ),
      ];
    } else if (prometheusResult && options.format === 'heatmap') {
      let seriesList: TimeSeries[] = [];
      for (const metricData of prometheusResult) {
        seriesList.push(this.transformMetricData(metricData, options, options.start, options.end));
      }
      seriesList.sort(sortSeriesByLabel);
      seriesList = this.transformToHistogramOverTime(seriesList);
      return seriesList;
    } else if (prometheusResult) {
      const seriesList: TimeSeries[] = [];
      for (const metricData of prometheusResult) {
        if (response.data.data.resultType === 'matrix') {
          seriesList.push(this.transformMetricData(metricData, options, options.start, options.end));
        } else if (response.data.data.resultType === 'vector') {
          seriesList.push(this.transformInstantMetricData(metricData, options));
        }
      }
      return seriesList;
    }
    return [];
  }

  transformMetricData(metricData: any, options: any, start: number, end: number): TimeSeries {
    const dps = [];
    const { name, labels, title } = this.createLabelInfo(metricData.metric, options);

    const stepMs = parseFloat(options.step) * 1000;
    let baseTimestamp = start * 1000;

    if (metricData.values === undefined) {
      throw new Error('Prometheus heatmap error: data should be a time series');
    }

    for (const value of metricData.values) {
      let dpValue: number | null = parseFloat(value[1]);

      if (_.isNaN(dpValue)) {
        dpValue = null;
      }

      const timestamp = parseFloat(value[0]) * 1000;
      for (let t = baseTimestamp; t < timestamp; t += stepMs) {
        dps.push([null, t]);
      }
      baseTimestamp = timestamp + stepMs;
      dps.push([dpValue, timestamp]);
    }

    const endTimestamp = end * 1000;
    for (let t = baseTimestamp; t <= endTimestamp; t += stepMs) {
      dps.push([null, t]);
    }

    return {
      datapoints: dps,
      refId: options.refId,
      target: name ?? '',
      tags: labels,
      title,
      meta: options.meta,
    };
  }

  transformMetricDataToTable(
    md: any,
    resultCount: number,
    refId: string,
    meta: QueryResultMeta,
    valueWithRefId?: boolean
  ): TableModel {
    const table = new TableModel();
    table.refId = refId;
    table.meta = meta;

    let i: number, j: number;
    const metricLabels: { [key: string]: number } = {};

    if (!md || md.length === 0) {
      return table;
    }

    // Collect all labels across all metrics
    _.each(md, series => {
      for (const label in series.metric) {
        if (!metricLabels.hasOwnProperty(label)) {
          metricLabels[label] = 1;
        }
      }
    });

    // Sort metric labels, create columns for them and record their index
    const sortedLabels = _.keys(metricLabels).sort();
    table.columns.push({ text: 'Time', type: FieldType.time });
    _.each(sortedLabels, (label, labelIndex) => {
      metricLabels[label] = labelIndex + 1;
      table.columns.push({ text: label, filterable: true });
    });
    const valueText = resultCount > 1 || valueWithRefId ? `Value #${refId}` : 'Value';
    table.columns.push({ text: valueText });

    // Populate rows, set value to empty string when label not present.
    _.each(md, series => {
      if (series.value) {
        series.values = [series.value];
      }
      if (series.values) {
        for (i = 0; i < series.values.length; i++) {
          const values = series.values[i];
          const reordered: any = [values[0] * 1000];
          if (series.metric) {
            for (j = 0; j < sortedLabels.length; j++) {
              const label = sortedLabels[j];
              if (series.metric.hasOwnProperty(label)) {
                if (label === 'le') {
                  reordered.push(parseHistogramLabel(series.metric[label]));
                } else {
                  reordered.push(series.metric[label]);
                }
              } else {
                reordered.push('');
              }
            }
          }
          reordered.push(parseFloat(values[1]));
          table.rows.push(reordered);
        }
      }
    });

    return table;
  }

  transformInstantMetricData(md: any, options: any): TimeSeries {
    const dps = [];
    const { name, labels } = this.createLabelInfo(md.metric, options);
    dps.push([parseFloat(md.value[1]), md.value[0] * 1000]);
    return { target: name ?? '', title: name, datapoints: dps, tags: labels, refId: options.refId, meta: options.meta };
  }

  createLabelInfo(labels: { [key: string]: string }, options: any): { name?: string; labels: Labels; title?: string } {
    if (options?.legendFormat) {
      const title = this.renderTemplate(this.templateSrv.replace(options.legendFormat, options?.scopedVars), labels);
      return { name: title, title, labels };
    }

    let { __name__, ...labelsWithoutName } = labels;

    let title = __name__ || '';

    const labelPart = formatLabels(labelsWithoutName);

    if (!title && !labelPart) {
      title = options.query;
    }

    title = `${__name__ ?? ''}${labelPart}`;

    return { name: title, title, labels: labelsWithoutName };
  }

  getOriginalMetricName(labelData: { [key: string]: string }) {
    const metricName = labelData.__name__ || '';
    delete labelData.__name__;
    const labelPart = Object.entries(labelData)
      .map(label => `${label[0]}="${label[1]}"`)
      .join(',');
    return `${metricName}{${labelPart}}`;
  }

  renderTemplate(aliasPattern: string, aliasData: { [key: string]: string }) {
    const aliasRegex = /\{\{\s*(.+?)\s*\}\}/g;
    return aliasPattern.replace(aliasRegex, (match, g1) => {
      if (aliasData[g1]) {
        return aliasData[g1];
      }
      return '';
    });
  }

  transformToHistogramOverTime(seriesList: TimeSeries[]) {
    /*      t1 = timestamp1, t2 = timestamp2 etc.
            t1  t2  t3          t1  t2  t3
    le10    10  10  0     =>    10  10  0
    le20    20  10  30    =>    10  0   30
    le30    30  10  35    =>    10  0   5
    */
    for (let i = seriesList.length - 1; i > 0; i--) {
      const topSeries = seriesList[i].datapoints;
      const bottomSeries = seriesList[i - 1].datapoints;
      if (!topSeries || !bottomSeries) {
        throw new Error('Prometheus heatmap transform error: data should be a time series');
      }

      for (let j = 0; j < topSeries.length; j++) {
        const bottomPoint = bottomSeries[j] || [0];
        topSeries[j][0]! -= bottomPoint[0]!;
      }
    }

    return seriesList;
  }
}

function sortSeriesByLabel(s1: TimeSeries, s2: TimeSeries): number {
  let le1, le2;

  try {
    // fail if not integer. might happen with bad queries
    le1 = parseHistogramLabel(s1.target);
    le2 = parseHistogramLabel(s2.target);
  } catch (err) {
    console.error(err);
    return 0;
  }

  if (le1 > le2) {
    return 1;
  }

  if (le1 < le2) {
    return -1;
  }

  return 0;
}

function parseHistogramLabel(le: string): number {
  if (le === '+Inf') {
    return +Infinity;
  }
  return Number(le);
}
