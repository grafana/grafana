import { QuerySuggestion } from '../types';

interface TemplateData {
  template: string;
  description: string;
}

export const generalTemplates: TemplateData[] = [
  {
    template: 'metric_a{}',
    description: 'Get the data for "metric_a"',
  },
  {
    template: 'avg by(c) (metric_a{})',
    description: 'Average of all series in "metric_a" grouped by the label "c"',
  },
  {
    template: 'count by(d) (metric_a{})',
    description: 'Number of series in the metric "metric_a" grouped by the label "d"',
  },
  {
    template: 'sum by(g) (sum_over_time(metric_a{}[1h]))',
    description:
      'For each series in the metric "metric_a", sum all values over 1 hour, then group those series by label "g" and sum.',
  },
  {
    template: 'count(metric_a{})',
    description: 'Count of series in the metric "metric_a"',
  },
  {
    template: '(metric_a{})',
    description: 'Get the data for "metric_a"',
  },
  {
    template: 'count_over_time(metric_a{}[1h])',
    description: 'Number of series of metric_a in a 1 hour interval',
  },
  {
    template: 'changes(metric_a{}[1m])',
    description: 'Number of times the values of each series in metric_a have changed in 1 minute periods',
  },
  {
    template: 'count(count by(g) (metric_a{}))',
    description: 'Total number of series in metric_a',
  },
  {
    template: 'last_over_time(metric_a{}[1h])',
    description: 'For each series in metric_a, get the last value in the 1 hour period.',
  },
  {
    template: 'sum by(g) (count_over_time(metric_a{}[1h]))',
    description: 'Grouped sum over the label "g" of the number of series of metric_a in a 1 hour period',
  },
  {
    template: 'count(metric_a{} == 99)',
    description: 'Number of series of metric_a that have value 99',
  },
  {
    template: 'min(metric_a{})',
    description: 'At each timestamp, find the minimum of all series of the metric "metric_a"',
  },
  {
    template: 'metric_a{} != 99',
    description: 'Series of metric_a which do not have the value 99',
  },
  {
    template: 'metric_a{} - 99',
    description: 'metric_a minus 99',
  },
  {
    template: 'quantile_over_time(0.99,metric_a{}[1h])',
    description: 'The 99th quantile of values of metric_a in 1 hour',
  },
  {
    template: 'count_values("aaaa",metric_a{})',
    description: 'Count number of label values for a label named "aaaa"',
  },
];

export const counterTemplates: TemplateData[] = [
  {
    template: 'sum by(d) (rate(metric_a{}[1h]))',
    description:
      'Sum of the rate of increase or decrease of the metric "metric_a" per 1 hour period, grouped by the label "d"',
  },
  {
    template: 'rate(metric_a{}[1m])',
    description: 'Rate of change of the metric "metric_a" over 1 minute',
  },
  {
    template: 'sum by(a) (increase(metric_a{}[5m]))',
    description:
      'Taking the metric "metric_a" find the increase in 5 minute periods of each series and aggregate sum over the label "a"',
  },
  {
    template: 'sum(rate(metric_a{}[1m]))',
    description: 'Total rate of change of all series of metric "metric_a" in 1 minute intervals',
  },
  {
    template: 'sum(increase(metric_a{}[10m]))',
    description: 'Total increase for each series of metric "metric_a" in 10 minute intervals',
  },
  {
    template: 'increase(metric_a{}[1h])',
    description: 'Increase in all series of "metric_a" in 1 hour period',
  },
  {
    template: 'sum by(d) (irate(metric_a{}[1h]))',
    description: 'Sum of detailed rate of change of the metric "metric_a" over 1 hour grouped by label "d"',
  },
  {
    template: 'irate(metric_a{}[1h])',
    description: 'Detailed rate of change of the metric "metric_a" over 1 hour',
  },
  {
    template: 'avg by(d) (rate(metric_a{}[1h]))',
    description:
      'Taking the rate of change of the metric "metric_a" in a 1 hour period, group by the label "d" and find the average of each group',
  },
  {
    template: 'topk(5,sum by(g) (rate(metric_a{}[1h])))',
    description: 'Top 5 of the summed groups "g" of the rate of change of metric_a',
  },
  {
    template: 'sum(rate(metric_a{}[1h])) / sum(rate(metric_a{}[1h]))',
    description: 'Relative sums of metric_a with different labels',
  },
  {
    template: 'histogram_quantile(99,rate(metric_a{}[1h]))',
    description: '99th percentile of the rate of change of metric_a in 1 hour periods',
  },
  {
    template: 'avg(rate(metric_a{}[1m]))',
    description: 'Average of the rate of all series of metric_a in 1 minute periods',
  },
  {
    template: 'rate(metric_a{}[5m]) > 99',
    description: 'Show series of metric_a only if their rate over 5 minutes is greater than 99',
  },
  {
    template: 'count by(g) (rate(metric_a{}[1h]))',
    description: 'Count of series of metric_a over all labels "g"',
  },
];

export const histogramTemplates: TemplateData[] = [
  {
    template: 'histogram_quantile(99,sum by(le) (rate(metric_a{}[1h])))',
    description:
      'Calculate the rate at which the metric "metric_a" is increasing or decreasing, summed over each bucket label "le", and then calculates the 99th percentile of those rates.',
  },
  {
    template: 'histogram_quantile(99,sum by(g) (metric_a{}))',
    description: '99th percentile of the sum of metric_a grouped by label "g"',
  },
  {
    template: 'histogram_quantile(99,sum by(g) (irate(metric_a{}[1h])))',
    description: '99th percentile of the grouped by "g" sum of the rate of each series in metric_a in an hour',
  },
  {
    template: 'histogram_quantile(99,metric_a{})',
    description: '99th percentile of metric_a',
  },
];

export const gaugeTemplates: TemplateData[] = [
  {
    template: 'sum by(c) (metric_a{})',
    description: 'Sum the metric "metric_a" by each value in label "c"',
  },
  {
    template: 'sum(metric_a{})',
    description: 'Total sum of all the series of the metric named "metric_a"',
  },
  {
    template: 'max by(dd) (metric_a{})',
    description: 'Grouping the series the metric "metric_a" by the label "dd", get the maximum value of each group',
  },
  {
    template: 'max(metric_a{})',
    description: 'Maximum value of all series of the metric "metric_a" ',
  },
  {
    template: 'avg(metric_a{})',
    description: 'Average value of all the series of metric "metric_a"',
  },
  {
    template: 'metric_a{} > 99',
    description: 'Show only the series of metric "metric_a" which currently have value greater than 99',
  },
  {
    template: 'metric_a{} / 99',
    description: 'Values for "metric_a" all divided by 99',
  },
  {
    template: 'metric_a{} == 99',
    description: 'Show series of metric_a that have value 99',
  },
  {
    template: 'sum_over_time(metric_a{}[1h])',
    description: 'Sum each series of metric_a over 1 hour',
  },
  {
    template: 'avg_over_time(metric_a{}[1h])',
    description: 'Average of each series of metric_a in a 1 hour period',
  },
  {
    template: 'sum(sum_over_time(metric_a{}[1h]))',
    description: 'Sum of all values in all series in a 1 hour period',
  },
  {
    template: 'delta(metric_a{}[1m])',
    description: 'Span or delta (maximum - minimum) of values of the metric "metric_a" in a 1 minute period. ',
  },
  {
    template: 'avg by(g) (avg_over_time(metric_a{}[1h]))',
    description:
      'For 1 hour, take each series and find the average, then group by label "g" and find the average of each group',
  },
  {
    template: 'max_over_time(metric_a{}[1h])',
    description: 'Maximum values of each series in metric "metric_a" in a 1 hour period',
  },
  {
    template: 'metric_a{} * 99',
    description: 'Values of metric_a multiplied by 99',
  },
  {
    template: 'metric_a{} < 99',
    description: 'Series of metric_a that have values less than 99',
  },
  {
    template: 'max by() (max_over_time(metric_a{}[1h]))',
    description: 'Find maximum value of all series in 1 hour periods',
  },
  {
    template: 'topk(99,metric_a{})',
    description: 'First 5 series of metric_a that have the highest values',
  },
  {
    template: 'min by(g) (metric_a{})',
    description: 'Minimum values of the series of metric_a grouped by label "g"',
  },
  {
    template: 'topk(10,sum by(g) (metric_a{}))',
    description: "Top 10 of the series of metric_a grouped and summed by the label 'g'",
  },
  {
    template: 'avg(avg_over_time(metric_a{}[1h]))',
    description: 'Average of all values inside a 1 hour period',
  },
  {
    template: 'quantile by(h) (0.95,metric_a{})',
    description: 'Calculate 95th percentile of metric_a when aggregated by the label "h"',
  },
  {
    template: 'avg by(g) (metric_a{} > 99)',
    description:
      'Taking all series of metric_a with value greater than 99, group by label "g" and find the average of each group',
  },
  {
    template: 'sum(metric_a{}) / 99',
    description: 'Sum of all series of metric_a divided by 99',
  },
  {
    template: 'count(sum by(g) (metric_a{}))',
    description: 'Number of series of metric_a grouped by the label "g"',
  },
  {
    template: 'max(max_over_time(metric_a{}[1h]))',
    description: 'Find the max value of all series of metric_a in a 1 hour period',
  },
];

function processTemplate(templateData: TemplateData, metric: string, labels: string): QuerySuggestion {
  return {
    query: templateData.template.replace('metric_a', metric).replace('{}', labels),
    explanation: templateData.description.replace('metric_a', metric),
  };
}

export function getTemplateSuggestions(metricName: string, metricType: string, labels: string): QuerySuggestion[] {
  let templateSuggestions: QuerySuggestion[] = [];
  switch (metricType) {
    case 'counter':
      templateSuggestions = templateSuggestions.concat(
        counterTemplates
          .map((t) => processTemplate(t, metricName, labels))
          .sort(() => Math.random() - 0.5)
          .slice(0, 2)
      );
      templateSuggestions = templateSuggestions.concat(
        generalTemplates
          .map((t) => processTemplate(t, metricName, labels))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
      );
      break;
    case 'gauge':
      templateSuggestions = templateSuggestions.concat(
        gaugeTemplates
          .map((t) => processTemplate(t, metricName, labels))
          .sort(() => Math.random() - 0.5)
          .slice(0, 2)
      );
      templateSuggestions = templateSuggestions.concat(
        generalTemplates
          .map((t) => processTemplate(t, metricName, labels))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
      );
      break;
    case 'histogram':
      templateSuggestions = templateSuggestions.concat(
        histogramTemplates
          .map((t) => processTemplate(t, metricName, labels))
          .sort(() => Math.random() - 0.5)
          .slice(0, 2)
      );
      templateSuggestions = templateSuggestions.concat(
        generalTemplates
          .map((t) => processTemplate(t, metricName, labels))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
      );
      break;
    default:
      templateSuggestions = templateSuggestions.concat(
        generalTemplates
          .map((t) => processTemplate(t, metricName, labels))
          .sort(() => Math.random() - 0.5)
          .slice(0, 5)
      );
      break;
  }
  return templateSuggestions;
}
