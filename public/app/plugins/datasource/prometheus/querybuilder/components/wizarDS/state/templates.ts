import { Suggestion } from '../types';

export const componentTemplates: Suggestion[] = [
  {
    route: `/explore`,
    target: `[aria-label="Query patterns"]`,
    title: `Turbo charge`,
    content: `This is the 'Kick start your query' button. It will help you get started with your first query!`,
    component: 'Kickstart your query',
    explanation: `Click to see a list of operation patterns that help you quickly get started adding multiple operations to your query. These include:
      \n
      \n
      Rate query starters
      \n
      Histogram query starters
      \n
      Binary query starters`,
    testid: 'wizard-prometheus-kickstart-your-query',
    order: 1,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#toolbar-elements',
  },
  {
    route: `/explore`,
    target: `[aria-label="metric-select"]`,
    title: 'Metric select',
    content: 'Metric select',
    component: 'Metric select',
    explanation: `When you are ready to create a query, you can choose the specific metric name from the dropdown list under Metric. The data source requests the list of available metrics from the Prometheus server based on the selected time rage. You can also enter text into the selector when the dropdown is open to search and filter the list.`,
    testid: 'wizard-prometheus-metric-select',
    order: 2,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#metrics',
  },
  {
    route: `/explore`,
    target: `[aria-label="label-filters"]`,
    title: 'Label filters',
    content: 'Label filters',
    component: 'Label filters',
    explanation: `Select desired labels and their values from the dropdown list. When a metric is selected, the data source requests available labels and their values from the server. Use the + button to add a label, and the x button to remove a label.`,
    testid: 'wizard-prometheus-label-filter',
    order: 3,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#label-filters',
  },
  {
    route: `/explore`,
    target: `[data-testid="prometheus-operations"]`,
    title: 'Operations',
    content: 'Operations',
    component: 'Operations',
    explanation: `Select the + Operations button to add operations to your query.
      \n
      The query editor groups operations into the following sections:
      \n
      \n
      Aggregations - for additional information see Aggregation operators.
      \n
      Range functions - for additional information see Functions.
      \n
      Functions - for additional information see Functions.
      \n
      Binary operations - for additional information see Binary operators.
      \n
      Trigonometric - for additional information see Trigonometric functions.
      \n
      Time functions - for additional information see Functions.
      \n
      All operations have function parameters under the operation header. Click the operator to see a full list of supported functions. Some operations allow you to apply specific labels to functions.`,
    testid: 'wizard-prometheus-operations',
    order: 4,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#operations',
  },
  {
    route: `/explore`,
    // needs actual target data-testid
    target: `[aria-label="prometheus-legend]`,
    title: 'Legend',
    content: 'Legend',
    component: 'Legend',
    explanation: `The Legend setting defines the time series’s name. You can use a predefined or custom format.
      \n
      \n
      Auto - Displays unique labels. Also displays all overlapping labels if a series has multiple labels.
      \n
      Verbose - Displays all label names.
      \n
      Custom - Uses templating to select which labels will be included. For example, {{hostname}} is replaced by the label value for the label hostname. Clear the input and click outside of it to select another mode.`,
    testid: 'wizard-prometheus-legend',
    order: 5,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#legend',
  },
  {
    route: `/explore`,
    // needs actual target aria-label
    target: `[aria-label="prometheus-minstep]`,
    title: 'Min step',
    content: 'Min step',
    component: 'Min step',
    explanation: `The Min step setting defines the lower bounds on the interval between data points. For example, set this to 1h to hint that measurements are taken hourly. This setting supports the $__interval and $__rate_interval macros.`,
    testid: 'wizard-prometheus-min-step',
    order: 6,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#min-step',
  },
  {
    route: `/explore`,
    // needs actual target aria-label
    target: `[aria-label="prometheus-format]`,
    title: 'Format',
    content: 'Format',
    component: 'Format',
    explanation: `Switch between the following format options:
      \n
      \n
      Time series - The default time series format. See Time series kind formats for information on time series data frames and how time and value fields are structured.
      \n
      Table - This works only in a Table panel.
      \n
      Heatmap - Displays metrics of the Histogram type on a Heatmap panel by converting cumulative histograms to regular ones and sorting the series by the bucket bound.`,
    testid: 'wizard-prometheus-format',
    order: 7,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#format',
  },
  {
    route: `/explore`,
    // needs actual target aria-label
    target: `[aria-label="prometheus-type]`,
    title: 'Type',
    content: 'Type',
    component: 'Type',
    explanation: `The Type setting sets the query type. These include:
      \n
      \n
      Both - The default option. Returns results for both a Range query and an Instant query.
      \n
      Range - Returns a range vector consisting of a set of time series data containing a range of data points over time for each time series. You can choose lines, bars, points, stacked lines or stacked bars
      \n
      Instant - Returns one data point per query and only the most recent point in the time range provided. The results can be shown in table format or as raw data. To depict instant query results in the time series panel, first add a field override, next add a property to the override named Transform, and finally select Constant from the Transform dropdown.`,
    testid: 'wizard-prometheus-type',
    order: 8,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#type',
  },
  {
    route: `/explore`,
    // needs actual target aria-label
    target: `[aria-label="prometheus-exemplars]`,
    title: 'Exemplars',
    content: 'Exemplars',
    component: 'Exemplars',
    explanation:
      'Toggle Exemplars to run a query that includes exemplars in the graph. Exemplars are unique to Prometheus.',
    testid: 'wizard-prometheus-exemplars',
    order: 9,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#exemplars',
  },
];

// UPDATE SUGGESTION LOGIC
export function getTemplateSuggestions(): Suggestion[] {
  return componentTemplates;
}
