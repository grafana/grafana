import { groupBy } from 'lodash';

import {
  DataFrame,
  Field as DataFrameField,
  DataFrameJSON,
  Field,
  FieldType,
  GrafanaTheme2,
  MappingType,
  ThresholdsMode,
  getDisplayProcessor,
} from '@grafana/data';
import { fieldIndexComparer } from '@grafana/data/internal';
import { mapStateWithReasonToBaseState } from 'app/types/unified-alerting-dto';

import { labelsMatchMatchers } from '../../../utils/alertmanager';
import { parsePromQLStyleMatcherLooseSafe } from '../../../utils/matchers';
import { LogRecord } from '../state-history/common';
import { isLine, isNumbers } from '../state-history/useRuleHistoryRecords';

import { LABELS_FILTER, STATE_FILTER_FROM, STATE_FILTER_TO, StateFilterValues } from './CentralAlertHistoryScene';

const GROUPING_INTERVAL = 10 * 1000; // 10 seconds
const QUERY_PARAM_PREFIX = 'var-'; // Prefix used by Grafana to sync variables in the URL

/**
 * Parse label filters and prepare backend filters.
 * Backend supports only exact matchers.
 */
export function parseBackendLabelFilters(labelFilter: string): Record<string, string> {
  const labelMatchers = parsePromQLStyleMatcherLooseSafe(labelFilter);
  const labelFilters: Record<string, string> = {};

  labelMatchers.forEach((matcher) => {
    if (!matcher.isRegex && matcher.isEqual) {
      labelFilters[matcher.name] = matcher.value;
    }
  });

  return labelFilters;
}

interface HistoryFilters {
  stateTo: string;
  stateFrom: string;
  labels: string;
}

const emptyFilters: HistoryFilters = {
  stateTo: 'all',
  stateFrom: 'all',
  labels: '',
};

/*
 * This function is used to convert the history response to a DataFrame list and filter the data by labels and states
 * The response is a list of log records, each log record has a timestamp and a line.
 * We group all records by alert instance (unique set of labels) and create a DataFrame for each group (instance).
 * This allows us to be able to filter by labels and states in the groupDataFramesByTime function.
 */
export function historyResultToDataFrame({ data }: DataFrameJSON, filters = emptyFilters): DataFrame[] {
  const { stateTo, stateFrom } = filters;

  // Extract timestamps and lines from the response
  const [tsValues = [], lines = []] = data?.values ?? [];
  const timestamps = isNumbers(tsValues) ? tsValues : [];

  // Filter log records by state and create a list of log records with the timestamp and line
  const logRecords = timestamps.reduce<LogRecord[]>((acc, timestamp: number, index: number) => {
    const line = lines[index];
    if (!isLine(line)) {
      return acc;
    }

    // we have to filter out by state at that point , because we are going to group by timestamp and these states are going to be lost
    const baseStateTo = mapStateWithReasonToBaseState(line.current);
    const baseStateFrom = mapStateWithReasonToBaseState(line.previous);
    const stateToMatch = stateTo !== StateFilterValues.all ? stateTo === baseStateTo : true;
    const stateFromMatch = stateFrom !== StateFilterValues.all ? stateFrom === baseStateFrom : true;

    // filter by state
    if (stateToMatch && stateFromMatch) {
      acc.push({ timestamp, line });
    }

    return acc;
  }, []);

  // Group log records by alert instance
  const logRecordsByInstance = groupBy(logRecords, (record: LogRecord) => {
    return JSON.stringify(record.line.labels);
  });

  // Convert each group of log records to a DataFrame
  const dataFrames: DataFrame[] = Object.entries(logRecordsByInstance).map<DataFrame>(([key, records]) => {
    // key is the stringified labels
    return logRecordsToDataFrame(key, records);
  });

  // Group DataFrames by time and filter by labels
  return groupDataFramesByTimeAndFilterByLabels(dataFrames, filters);
}

// Scenes sync variables in the URL adding a prefix to the variable name.
export function getLabelsFilterInQueryParams() {
  const queryParams = new URLSearchParams(window.location.search);
  return queryParams.get(`${QUERY_PARAM_PREFIX}${LABELS_FILTER}`) ?? '';
}

export function getStateFilterToInQueryParams() {
  const queryParams = new URLSearchParams(window.location.search);
  return queryParams.get(`${QUERY_PARAM_PREFIX}${STATE_FILTER_TO}`) ?? StateFilterValues.all;
}

export function getStateFilterFromInQueryParams() {
  const queryParams = new URLSearchParams(window.location.search);
  return queryParams.get(`${QUERY_PARAM_PREFIX}${STATE_FILTER_FROM}`) ?? StateFilterValues.all;
}

/*
 * This function groups the data frames by time and filters them by labels.
 * The interval is set to 10 seconds.
 * */
export function groupDataFramesByTimeAndFilterByLabels(dataFrames: DataFrame[], filters: HistoryFilters): DataFrame[] {
  // Filter data frames by labels. This is used to filter out the data frames that do not match the query.
  const labelsFilterValue = filters.labels;
  const dataframesFiltered = dataFrames.filter((frame) => {
    const labels = JSON.parse(frame.name ?? ''); // in name we store the labels stringified

    const matchers = Boolean(labelsFilterValue) ? parsePromQLStyleMatcherLooseSafe(labelsFilterValue) : [];
    return labelsMatchMatchers(labels, matchers);
  });
  // Extract time fields from filtered data frames
  const timeFieldList = dataframesFiltered.flatMap((frame) => frame.fields.find((field) => field.name === 'time'));

  // Group time fields by interval
  const groupedTimeFields = groupBy(
    timeFieldList?.flatMap((tf) => tf?.values),
    (time: number) => Math.floor(time / GROUPING_INTERVAL) * GROUPING_INTERVAL
  );

  // Create new time field with grouped time values
  const newTimeField: Field = {
    name: 'time',
    type: FieldType.time,
    values: Object.keys(groupedTimeFields).map(Number),
    config: { displayName: 'Time', custom: { fillOpacity: 100 } },
  };

  // Create count field with count of records in each group
  const countField: Field = {
    name: 'value',
    type: FieldType.number,
    values: Object.values(groupedTimeFields).map((group) => group.length),
    config: {},
  };

  // Return new DataFrame with time and count fields
  return [
    {
      fields: [newTimeField, countField],
      length: newTimeField.values.length,
    },
  ];
}

/*
 * This function is used to convert the log records to a DataFrame.
 * The DataFrame has two fields: time and value.
 * The time field is the timestamp of the log record.
 * The value field is always 1.
 * */
function logRecordsToDataFrame(instanceLabels: string, records: LogRecord[]): DataFrame {
  const timeField: DataFrameField = {
    name: 'time',
    type: FieldType.time,
    values: [...records.map((record) => record.timestamp)],
    config: { displayName: 'Time', custom: { fillOpacity: 100 } },
  };

  // Sort time field values
  const timeIndex = timeField.values.map((_, index) => index);
  timeIndex.sort(fieldIndexComparer(timeField));

  // Create DataFrame with time and value fields
  const frame: DataFrame = {
    fields: [
      {
        ...timeField,
        values: timeField.values.map((_, i) => timeField.values[timeIndex[i]]),
      },
      {
        name: instanceLabels,
        type: FieldType.number,
        values: timeField.values.map((record) => 1),
        config: {},
      },
    ],
    length: timeField.values.length,
    name: instanceLabels,
  };

  return frame;
}

/*
 * This function is used to convert the log records to a DataFrame.
 * The DataFrame has two fields: time and value.
 * The time field is the timestamp of the log record.
 * The value field is the state of the log record.
 * The state is converted to a string and color is assigned based on the state.
 * The state can be Alerting, Pending, Recovering, Normal, or NoData.
 *
 * */
export function logRecordsToDataFrameForState(records: LogRecord[], theme: GrafanaTheme2): DataFrame {
  const timeField: DataFrameField = {
    name: 'time',
    type: FieldType.time,
    values: [...records.map((record) => record.timestamp), Date.now()],
    config: { displayName: 'Time', custom: { fillOpacity: 100 } },
  };

  // Sort time field values
  const timeIndex = timeField.values.map((_, index) => index);
  timeIndex.sort(fieldIndexComparer(timeField));

  const stateValues = [...records.map((record) => record.line.current), records.at(-1)?.line.current];

  // Create DataFrame with time and value fields
  const frame: DataFrame = {
    fields: [
      {
        ...timeField,
        values: timeField.values.map((_, i) => timeField.values[timeIndex[i]]),
      },
      {
        name: 'State',
        type: FieldType.string,
        values: stateValues.map((_, i) => stateValues[timeIndex[i]]),
        config: {
          displayName: 'State',
          color: { mode: 'thresholds' },
          custom: { fillOpacity: 100 },
          mappings: [
            {
              type: MappingType.ValueToText,
              options: {
                Alerting: {
                  color: theme.colors.error.main,
                },
                Pending: {
                  color: theme.colors.warning.main,
                },
                Recovering: {
                  color: theme.colors.warning.main,
                },
                Normal: {
                  color: theme.colors.success.main,
                },
                NoData: {
                  color: theme.colors.info.main,
                },
              },
            },
          ],
          thresholds: {
            mode: ThresholdsMode.Absolute,
            steps: [],
          },
        },
      },
    ],
    length: timeField.values.length,
    name: '',
  };
  frame.fields.forEach((field) => {
    field.display = getDisplayProcessor({ field, theme });
  });

  return frame;
}
