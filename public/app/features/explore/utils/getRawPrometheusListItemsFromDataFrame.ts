import { DataFrame, formattedValueToString } from '@grafana/data/src';

import { instantQueryRawVirtualizedListData } from '../PrometheusListView/RawListContainer';

type instantQueryMetricList = { [index: string]: { [index: string]: instantQueryRawVirtualizedListData } };

export const RawPrometheusListItemEmptyValue = ' ';

/**
 * transform dataFrame to instantQueryRawVirtualizedListData
 * @param dataFrame
 */
export const getRawPrometheusListItemsFromDataFrame = (dataFrame: DataFrame): instantQueryRawVirtualizedListData[] => {
  const metricList: instantQueryMetricList = {};
  const outputList: instantQueryRawVirtualizedListData[] = [];

  // Filter out time
  const newFields = dataFrame.fields.filter((field) => !['Time'].includes(field.name));

  // Get name from each series
  let metricNames: string[] = newFields.find((field) => field.name === '__name__')?.values ?? [];
  if (!metricNames.length && newFields.length && newFields[0].values.length) {
    // These results do not have series labels
    // Matching the native prometheus UI which appears to only show the permutations of the first field in the query result.
    metricNames = Array(newFields[0].values.length).fill('');
  }

  // Get everything that isn't the name from each series
  const metricLabels = dataFrame.fields.filter((field) => !['__name__'].includes(field.name));

  metricNames.forEach(function (metric: string, i: number) {
    metricList[metric] = {};
    const formattedMetric: instantQueryRawVirtualizedListData = metricList[metric][i] ?? {};

    for (const field of metricLabels) {
      const label = field.name;

      if (label !== 'Time') {
        // Initialize the objects
        if (typeof field?.display === 'function') {
          const stringValue = formattedValueToString(field?.display(field.values[i]));
          if (stringValue) {
            formattedMetric[label] = stringValue;
          } else if (label.includes('Value #')) {
            formattedMetric[label] = RawPrometheusListItemEmptyValue;
          }
        } else {
          console.warn('Field display method is missing!');
        }
      }
    }

    outputList.push({
      ...formattedMetric,
      __name__: metric,
    });
  });

  return outputList;
};
