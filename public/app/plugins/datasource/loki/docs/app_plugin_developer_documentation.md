# Loki data source documentation for app plugins developers

Welcome to the developer documentation for the Loki data source! The purpose of this document is to assist app plugin developers in leveraging the power of the Loki data source and Grafana. The Loki data source provides a set of methods to simplify common tasks, making it easier to create engaging app plugins.

## Introduction

The Loki data source provides a variety of methods and components, but not all of them are suitable for external use. In this documentation, we will focus on the key methods that are highly recommended for app plugin development.

It's important to note some methods and APIs were deliberately omitted, as those may undergo changes or are not suitable for external integration. Therefore, we do not recommend relying on them for your development needs.

## Recommended methods

We strongly advise using these recommended methods instead of direct API calls because they offer several benefits:

- Caching of results: These methods intelligently cache results based on their input arguments and the currently selected time range. This caching mechanism improves performance by reducing redundant fetch requests.

- Proper authentication handling: The recommended methods correctly handle custom authentication data source options, ensuring seamless authentication when making requests. This enhances both security and data access control.

- Improved instrumentation: By opting for these recommended methods, you gain access to advanced instrumentation features. These features provide better monitoring and analysis capabilities, offering deeper insights into your data source interactions.
  > Note: To leverage the enhanced instrumentation, you as an app developer need to have access to server logs, metrics, and traces.

### Fetching Loki label names

`datasource.languageProvider.fetchLabels()` can be used to fetch label names from the connected Loki data source. Labels are essential for selecting and filtering log data. You can use this method to retrieve labels, providing a foundation for various data manipulation tasks within your app plugin.

```ts
/**
 * Fetch all label keys
 * This asynchronous function is designed to retrieve all available label keys from the data source.
 * It returns a promise that resolves to an array of strings containing the label keys.
 *
 * @param options - (Optional) An object containing additional options - currently only time range.
 * @param options.timeRange - (Optional) The time range for which you want to retrieve label keys. If not provided, the default time range is used.
 * @returns A promise containing an array of label keys.
 * @throws An error if the fetch operation fails.
 */
async function fetchLabels(options?: { timeRange?: TimeRange }): Promise<string[]>;

/**
 * Example usage:
 */

try {
  const labelKeys = await fetchLabels();
  console.log(labelKeys);
} catch (error) {
  console.error(`Error fetching label keys: ${error.message}`);
}
```

### Fetching Loki label values

The `datasource.languageProvider.fetchLabelValues()` method is designed for fetching label values. This API enables you to retrieve the values associated with a particular label.

```ts
/**
 * Fetch label values
 *
 * This asynchronous function fetches values associated with a specified label name.
 * It returns a promise that resolves to an array of strings containing the label values.
 *
 * @param labelName - The name of the label for which you want to retrieve values.
 * @param options - (Optional) An object containing additional options.
 * @param options.streamSelector - (Optional) The stream selector to filter label values. If not provided, all label values are fetched.
 * @param options.timeRange - (Optional) The time range for which you want to retrieve label values. If not provided, the default time range is used.
 * @returns A promise containing an array of label values.
 * @throws An error if the fetch operation fails.
 */
async function fetchLabelValues(
  labelName: string,
  options?: { streamSelector?: string; timeRange?: TimeRange }
): Promise<string[]>;

/**
 * Example usage without stream selector:
 */

const labelName = 'job';
try {
  const values = await fetchLabelValues(labelName);
  console.log(values);
} catch (error) {
  console.error(`Error fetching label values: ${error.message}`);
}

/**
 * Example usage with stream selector:
 */

const labelName = 'job';
const streamSelector = '{app="grafana"}';
try {
  const values = await fetchLabelValues(labelName, { streamSelector });
  console.log(values);
} catch (error) {
  console.error(`Error fetching label values: ${error.message}`);
}
```

### Fetching Loki labels for a specified selector

`datasource.languageProvider.fetchSeriesLabels` can be used to fetch available labels for a given stream selector.

```ts
/**
 * Fetch series labels for a selector
 *
 * This method fetches labels for a given stream selector, such as `{job="grafana"}`.
 * It returns a promise that resolves to a record mapping label names to their corresponding values.
 *
 * @param streamSelector - The stream selector for which you want to retrieve labels.
 * @param options - (Optional) An object containing additional options - currently only time range.
 * @param options.timeRange - (Optional) The time range for which you want to retrieve label keys. If not provided, the default time range is used.
 * @returns A promise containing a record of label names and their values.
 * @throws An error if the fetch operation fails.
 */
async function fetchSeriesLabels(
  streamSelector: string,
  options?: { timeRange?: TimeRange }
): Promise<Record<string, string[]>>;

/**
 * Example usage:
 */
const streamSelector = '{job="grafana"}';
try {
  const labels = await fetchSeriesLabels(streamSelector);
  console.log(labels);
} catch (error) {
  console.error(`Error fetching labels: ${error.message}`);
}
```

### Detecting Loki parser and label keys for log stream based on sampled lines

`datasource.languageProvider.getParserAndLabelKeys` receives a stream selector and returns the parsers and label keys that the query would generate. This is achieved by executing a sample query to Loki with the specified stream and extracting relevant information from the received log lines.

```ts
/**
 * Get parser and label keys for a selector
 *
 * This asynchronous function is used to fetch parsers and label keys for a selected log stream based on sampled lines.
 * It returns a promise that resolves to an object with the following properties:
 *
 * - `extractedLabelKeys`: An array of available label keys associated with the log stream.
 * - `hasJSON`: A boolean indicating whether JSON parsing is available for the stream.
 * - `hasLogfmt`: A boolean indicating whether Logfmt parsing is available for the stream.
 * - `hasPack`: A boolean indicating whether Pack parsing is available for the stream.
 * - `unwrapLabelKeys`: An array of label keys that can be used for unwrapping log data.
 *
 * @param streamSelector - The selector for the log stream you want to analyze.
 * @param options - (Optional) An object containing additional options.
 * @param options.maxLines - (Optional) The number of log lines requested when determining parsers and label keys.
 * @param options.timeRange - (Optional) The time range for which you want to retrieve label keys. If not provided, the default time range is used.
 * Smaller maxLines is recommended for improved query performance. The default count is 10.
 * @returns A promise containing an object with parser and label key information.
 * @throws An error if the fetch operation fails.
 */
async function getParserAndLabelKeys(
  streamSelector: string,
  options?: { maxLines?: number; timeRange?: TimeRange }
): Promise<{
  extractedLabelKeys: string[];
  hasJSON: boolean;
  hasLogfmt: boolean;
  hasPack: boolean;
  unwrapLabelKeys: string[];
}>;

/**
 * Example usage:
 */
const streamSelector = '{job="grafana"}';
try {
  const parserAndLabelKeys = await getParserAndLabelKeys(streamSelector, { maxLines: 5 });
  console.log(parserAndLabelKeys);
} catch (error) {
  console.error(`Error fetching parser and label keys: ${error.message}`);
}
```

If you find that there are methods missing or have ideas for new features, please don't hesitate to inform us. You can submit your suggestions and feature requests through the [Grafana repository](https://github.com/grafana/grafana/issues/new?assignees=&labels=type%2Ffeature-request&projects=&template=1-feature_requests.md). Your feedback is essential to help us improve and enhance the Loki data source and Grafana as a whole. We appreciate your contributions and look forward to hearing your ideas!

## Recommended components

### QueryEditor

The Loki data source provides an export of the `QueryEditor` component, which can be accessed through `components?.QueryEditor`. This component is designed to enable users to create and customize Loki queries to suit their specific requirements.
