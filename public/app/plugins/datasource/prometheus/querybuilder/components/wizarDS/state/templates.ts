import { Suggestion } from '../types';

export const componentTemplates: Suggestion[] = [
  {
    component: 'Kickstart your query',
    explanation: `Click to see a list of operation patterns that help you quickly get started adding multiple operations to your query. These include:

      Rate query starters
      Histogram query starters
      Binary query starters`,
    testid: 'wizard-prometheus-kickstart-your-query',
    order: 1,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#toolbar-elements',
  },
  {
    component: 'Metric select',
    explanation: `When you are ready to create a query, you can choose the specific metric name from the dropdown list under Metric. The data source requests the list of available metrics from the Prometheus server based on the selected time rage. You can also enter text into the selector when the dropdown is open to search and filter the list.`,
    testid: 'wizard-prometheus-metric-select',
    order: 2,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#metrics',
  },
  {
    component: 'Label filters',
    explanation: `Select desired labels and their values from the dropdown list. When a metric is selected, the data source requests available labels and their values from the server. Use the + button to add a label, and the x button to remove a label.`,
    testid: 'wizard-prometheus-label-filter',
    order: 3,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#label-filters',
  },
  {
    component: 'Operations',
    explanation:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    testid: 'wizard-prometheus-operations',
    order: 4,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#operations',
  },
  {
    component: 'Legend',
    explanation: `The Legend setting defines the time series’s name. You can use a predefined or custom format.

      Auto - Displays unique labels. Also displays all overlapping labels if a series has multiple labels.
      Verbose - Displays all label names.
      Custom - Uses templating to select which labels will be included. For example, {{hostname}} is replaced by the label value for the label hostname. Clear the input and click outside of it to select another mode.`,
    testid: 'wizard-prometheus-legend',
    order: 5,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#legend',
  },
  {
    component: 'Min step',
    explanation: `The Min step setting defines the lower bounds on the interval between data points. For example, set this to 1h to hint that measurements are taken hourly. This setting supports the $__interval and $__rate_interval macros.`,
    testid: 'wizard-prometheus-min-step',
    order: 6,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#min-step',
  },
  {
    component: 'Format',
    explanation: `Switch between the following format options:

      Time series - The default time series format. See Time series kind formats for information on time series data frames and how time and value fields are structured.
      Table - This works only in a Table panel.
      Heatmap - Displays metrics of the Histogram type on a Heatmap panel by converting cumulative histograms to regular ones and sorting the series by the bucket bound.`,
    testid: 'wizard-prometheus-format',
    order: 7,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#format',
  },
  {
    component: 'Type',
    explanation: `The Type setting sets the query type. These include:

      Both - The default option. Returns results for both a Range query and an Instant query.
      Range - Returns a range vector consisting of a set of time series data containing a range of data points over time for each time series. You can choose lines, bars, points, stacked lines or stacked bars
      Instant - Returns one data point per query and only the most recent point in the time range provided. The results can be shown in table format or as raw data. To depict instant query results in the time series panel, first add a field override, next add a property to the override named Transform, and finally select Constant from the Transform dropdown.`,
    testid: 'wizard-prometheus-type',
    order: 8,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#type',
  },
  {
    component: 'Exemplars',
    explanation:
      'Toggle Exemplars to run a query that includes exemplars in the graph. Exemplars are unique to Prometheus. For more information see Introduction to exemplars. https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#:~:text=Toggle%20Exemplars%20to%20run%20a%20query%20that%20includes%20exemplars%20in%20the%20graph.%20Exemplars%20are%20unique%20to%20Prometheus.%20For%20more%20information%20see%20Introduction%20to%20exemplars.',
    testid: 'wizard-prometheus-exemplars',
    order: 9,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#exemplars',
  },
];

// interface TemplateData {
//   template: string;
//   description: string;
// }

// // ADD TEST ID OR WHATEVER WE NEED FOR THE NEW TEMPLATES
// // THIS IS WHERE THE LIST OF COMPONENTS CAN GO
// export const generalTemplates: TemplateData[] = [
//   {
//     template: 'metric_a{}',
//     description: 'Get the data for "metric_a"',
//   },
//   {
//     template: 'avg by(c) (metric_a{})',
//     description: 'Average of all series in "metric_a" grouped by the label "c"',
//   },
//   {
//     template: 'count by(d) (metric_a{})',
//     description: 'Number of series in the metric "metric_a" grouped by the label "d"',
//   },
//   {
//     template: 'sum by(g) (sum_over_time(metric_a{}[1h]))',
//     description:
//       'For each series in the metric "metric_a", sum all values over 1 hour, then group those series by label "g" and sum.',
//   },
//   {
//     template: 'count(metric_a{})',
//     description: 'Count of series in the metric "metric_a"',
//   },
//   {
//     template: '(metric_a{})',
//     description: 'Get the data for "metric_a"',
//   },
//   {
//     template: 'count_over_time(metric_a{}[1h])',
//     description: 'Number of series of metric_a in a 1 hour interval',
//   },
//   {
//     template: 'changes(metric_a{}[1m])',
//     description: 'Number of times the values of each series in metric_a have changed in 1 minute periods',
//   },
//   {
//     template: 'count(count by(g) (metric_a{}))',
//     description: 'Total number of series in metric_a',
//   },
//   {
//     template: 'last_over_time(metric_a{}[1h])',
//     description: 'For each series in metric_a, get the last value in the 1 hour period.',
//   },
//   {
//     template: 'sum by(g) (count_over_time(metric_a{}[1h]))',
//     description: 'Grouped sum over the label "g" of the number of series of metric_a in a 1 hour period',
//   },
//   {
//     template: 'count(metric_a{} == 99)',
//     description: 'Number of series of metric_a that have value 99',
//   },
//   {
//     template: 'min(metric_a{})',
//     description: 'At each timestamp, find the minimum of all series of the metric "metric_a"',
//   },
//   {
//     template: 'metric_a{} != 99',
//     description: 'Series of metric_a which do not have the value 99',
//   },
//   {
//     template: 'metric_a{} - 99',
//     description: 'metric_a minus 99',
//   },
//   {
//     template: 'quantile_over_time(0.99,metric_a{}[1h])',
//     description: 'The 99th quantile of values of metric_a in 1 hour',
//   },
//   {
//     template: 'count_values("aaaa",metric_a{})',
//     description: 'Count number of label values for a label named "aaaa"',
//   },
// ];

// export const counterTemplates: TemplateData[] = [
//   {
//     template: 'sum by(d) (rate(metric_a{}[1h]))',
//     description:
//       'Sum of the rate of increase or decrease of the metric "metric_a" per 1 hour period, grouped by the label "d"',
//   },
//   {
//     template: 'rate(metric_a{}[1m])',
//     description: 'Rate of change of the metric "metric_a" over 1 minute',
//   },
//   {
//     template: 'sum by(a) (increase(metric_a{}[5m]))',
//     description:
//       'Taking the metric "metric_a" find the increase in 5 minute periods of each series and aggregate sum over the label "a"',
//   },
//   {
//     template: 'sum(rate(metric_a{}[1m]))',
//     description: 'Total rate of change of all series of metric "metric_a" in 1 minute intervals',
//   },
//   {
//     template: 'sum(increase(metric_a{}[10m]))',
//     description: 'Total increase for each series of metric "metric_a" in 10 minute intervals',
//   },
//   {
//     template: 'increase(metric_a{}[1h])',
//     description: 'Increase in all series of "metric_a" in 1 hour period',
//   },
//   {
//     template: 'sum by(d) (irate(metric_a{}[1h]))',
//     description: 'Sum of detailed rate of change of the metric "metric_a" over 1 hour grouped by label "d"',
//   },
//   {
//     template: 'irate(metric_a{}[1h])',
//     description: 'Detailed rate of change of the metric "metric_a" over 1 hour',
//   },
//   {
//     template: 'avg by(d) (rate(metric_a{}[1h]))',
//     description:
//       'Taking the rate of change of the metric "metric_a" in a 1 hour period, group by the label "d" and find the average of each group',
//   },
//   {
//     template: 'topk(5,sum by(g) (rate(metric_a{}[1h])))',
//     description: 'Top 5 of the summed groups "g" of the rate of change of metric_a',
//   },
//   {
//     template: 'sum(rate(metric_a{}[1h])) / sum(rate(metric_a{}[1h]))',
//     description: 'Relative sums of metric_a with different labels',
//   },
//   {
//     template: 'histogram_quantile(99,rate(metric_a{}[1h]))',
//     description: '99th percentile of the rate of change of metric_a in 1 hour periods',
//   },
//   {
//     template: 'avg(rate(metric_a{}[1m]))',
//     description: 'Average of the rate of all series of metric_a in 1 minute periods',
//   },
//   {
//     template: 'rate(metric_a{}[5m]) > 99',
//     description: 'Show series of metric_a only if their rate over 5 minutes is greater than 99',
//   },
//   {
//     template: 'count by(g) (rate(metric_a{}[1h]))',
//     description: 'Count of series of metric_a over all labels "g"',
//   },
// ];

// export const histogramTemplates: TemplateData[] = [
//   {
//     template: 'histogram_quantile(99,sum by(le) (rate(metric_a{}[1h])))',
//     description:
//       'Calculate the rate at which the metric "metric_a" is increasing or decreasing, summed over each bucket label "le", and then calculates the 99th percentile of those rates.',
//   },
//   {
//     template: 'histogram_quantile(99,sum by(g) (metric_a{}))',
//     description: '99th percentile of the sum of metric_a grouped by label "g"',
//   },
//   {
//     template: 'histogram_quantile(99,sum by(g) (irate(metric_a{}[1h])))',
//     description: '99th percentile of the grouped by "g" sum of the rate of each series in metric_a in an hour',
//   },
//   {
//     template: 'histogram_quantile(99,metric_a{})',
//     description: '99th percentile of metric_a',
//   },
// ];

// export const gaugeTemplates: TemplateData[] = [
//   {
//     template: 'sum by(c) (metric_a{})',
//     description: 'Sum the metric "metric_a" by each value in label "c"',
//   },
//   {
//     template: 'sum(metric_a{})',
//     description: 'Total sum of all the series of the metric named "metric_a"',
//   },
//   {
//     template: 'max by(dd) (metric_a{})',
//     description: 'Grouping the series the metric "metric_a" by the label "dd", get the maximum value of each group',
//   },
//   {
//     template: 'max(metric_a{})',
//     description: 'Maximum value of all series of the metric "metric_a" ',
//   },
//   {
//     template: 'avg(metric_a{})',
//     description: 'Average value of all the series of metric "metric_a"',
//   },
//   {
//     template: 'metric_a{} > 99',
//     description: 'Show only the series of metric "metric_a" which currently have value greater than 99',
//   },
//   {
//     template: 'metric_a{} / 99',
//     description: 'Values for "metric_a" all divided by 99',
//   },
//   {
//     template: 'metric_a{} == 99',
//     description: 'Show series of metric_a that have value 99',
//   },
//   {
//     template: 'sum_over_time(metric_a{}[1h])',
//     description: 'Sum each series of metric_a over 1 hour',
//   },
//   {
//     template: 'avg_over_time(metric_a{}[1h])',
//     description: 'Average of each series of metric_a in a 1 hour period',
//   },
//   {
//     template: 'sum(sum_over_time(metric_a{}[1h]))',
//     description: 'Sum of all values in all series in a 1 hour period',
//   },
//   {
//     template: 'delta(metric_a{}[1m])',
//     description: 'Span or delta (maximum - minimum) of values of the metric "metric_a" in a 1 minute period. ',
//   },
//   {
//     template: 'avg by(g) (avg_over_time(metric_a{}[1h]))',
//     description:
//       'For 1 hour, take each series and find the average, then group by label "g" and find the average of each group',
//   },
//   {
//     template: 'max_over_time(metric_a{}[1h])',
//     description: 'Maximum values of each series in metric "metric_a" in a 1 hour period',
//   },
//   {
//     template: 'metric_a{} * 99',
//     description: 'Values of metric_a multiplied by 99',
//   },
//   {
//     template: 'metric_a{} < 99',
//     description: 'Series of metric_a that have values less than 99',
//   },
//   {
//     template: 'max by() (max_over_time(metric_a{}[1h]))',
//     description: 'Find maximum value of all series in 1 hour periods',
//   },
//   {
//     template: 'topk(99,metric_a{})',
//     description: 'First 5 series of metric_a that have the highest values',
//   },
//   {
//     template: 'min by(g) (metric_a{})',
//     description: 'Minimum values of the series of metric_a grouped by label "g"',
//   },
//   {
//     template: 'topk(10,sum by(g) (metric_a{}))',
//     description: "Top 10 of the series of metric_a grouped and summed by the label 'g'",
//   },
//   {
//     template: 'avg(avg_over_time(metric_a{}[1h]))',
//     description: 'Average of all values inside a 1 hour period',
//   },
//   {
//     template: 'quantile by(h) (0.95,metric_a{})',
//     description: 'Calculate 95th percentile of metric_a when aggregated by the label "h"',
//   },
//   {
//     template: 'avg by(g) (metric_a{} > 99)',
//     description:
//       'Taking all series of metric_a with value greater than 99, group by label "g" and find the average of each group',
//   },
//   {
//     template: 'sum(metric_a{}) / 99',
//     description: 'Sum of all series of metric_a divided by 99',
//   },
//   {
//     template: 'count(sum by(g) (metric_a{}))',
//     description: 'Number of series of metric_a grouped by the label "g"',
//   },
//   {
//     template: 'max(max_over_time(metric_a{}[1h]))',
//     description: 'Find the max value of all series of metric_a in a 1 hour period',
//   },
// ];

// function processTemplate(templateData: Suggestion, metric: string, labels: string): Suggestion {
//   return {
//     component: templateData.component,
//     explanation: templateData.explanation,
//     testid: templateData.testid,
//     order: templateData.order,
//     link: templateData.link,
//   };
// }

// UPDATE SUGGESTION LOGIC
export function getTemplateSuggestions(): Suggestion[] {
  // let templateSuggestions: Suggestion[] = [];
  // switch (metricType) {
  //   case 'counter':
  //     templateSuggestions = templateSuggestions.concat(
  //       counterTemplates
  //         .map((t) => processTemplate(t, metricName, labels))
  //         .sort(() => Math.random() - 0.5)
  //         .slice(0, 2)
  //     );
  //     templateSuggestions = templateSuggestions.concat(
  //       generalTemplates
  //         .map((t) => processTemplate(t, metricName, labels))
  //         .sort(() => Math.random() - 0.5)
  //         .slice(0, 3)
  //     );
  //     break;
  //   case 'gauge':
  //     templateSuggestions = templateSuggestions.concat(
  //       gaugeTemplates
  //         .map((t) => processTemplate(t, metricName, labels))
  //         .sort(() => Math.random() - 0.5)
  //         .slice(0, 2)
  //     );
  //     templateSuggestions = templateSuggestions.concat(
  //       generalTemplates
  //         .map((t) => processTemplate(t, metricName, labels))
  //         .sort(() => Math.random() - 0.5)
  //         .slice(0, 3)
  //     );
  //     break;
  //   case 'histogram':
  //     templateSuggestions = templateSuggestions.concat(
  //       histogramTemplates
  //         .map((t) => processTemplate(t, metricName, labels))
  //         .sort(() => Math.random() - 0.5)
  //         .slice(0, 2)
  //     );
  //     templateSuggestions = templateSuggestions.concat(
  //       generalTemplates
  //         .map((t) => processTemplate(t, metricName, labels))
  //         .sort(() => Math.random() - 0.5)
  //         .slice(0, 3)
  //     );
  //     break;
  //   default:
  //     templateSuggestions = templateSuggestions.concat(
  //       generalTemplates
  //         .map((t) => processTemplate(t, metricName, labels))
  //         .sort(() => Math.random() - 0.5)
  //         .slice(0, 5)
  //     );
  //     break;
  // }
  // return templateSuggestions;\
  return componentTemplates;
}
