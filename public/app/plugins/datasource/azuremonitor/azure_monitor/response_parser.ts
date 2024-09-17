import { find, get } from 'lodash';

import { FetchResponse } from '@grafana/runtime';

import TimeGrainConverter from '../time_grain_converter';
import {
  AzureMonitorLocalizedValue,
  AzureMonitorLocations,
  AzureMonitorMetricAvailabilityMetadata,
  AzureMonitorMetricsMetadataResponse,
  AzureMonitorOption,
  AzureAPIResponse,
  Location,
  Subscription,
  Resource,
} from '../types';
export default class ResponseParser {
  static parseResponseValues<T>(
    result: AzureAPIResponse<T>,
    textFieldName: string,
    valueFieldName: string
  ): Array<{ text: string; value: string }> {
    const list: Array<{ text: string; value: string }> = [];

    if (!result) {
      return list;
    }

    for (let i = 0; i < result.value.length; i++) {
      if (!find(list, ['value', get(result.value[i], valueFieldName)])) {
        const value = get(result.value[i], valueFieldName);
        const text = get(result.value[i], textFieldName, value);

        list.push({
          text: text,
          value: value,
        });
      }
    }
    return list;
  }

  static parseResourceNames(
    result: AzureAPIResponse<Resource>,
    metricNamespace?: string
  ): Array<{ text: string; value: string }> {
    const list: Array<{ text: string; value: string }> = [];

    if (!result) {
      return list;
    }

    for (let i = 0; i < result.value.length; i++) {
      if (
        typeof result.value[i].type === 'string' &&
        (!metricNamespace || result.value[i].type.toLocaleLowerCase() === metricNamespace.toLocaleLowerCase())
      ) {
        list.push({
          text: result.value[i].name,
          value: result.value[i].name,
        });
      }
    }

    return list;
  }

  static parseMetadata(result: AzureMonitorMetricsMetadataResponse, metricName: string) {
    const defaultAggTypes = ['None', 'Average', 'Minimum', 'Maximum', 'Total', 'Count'];
    const metricData = result?.value.find((v) => v.name.value === metricName);

    if (!metricData) {
      return {
        primaryAggType: '',
        supportedAggTypes: defaultAggTypes,
        supportedTimeGrains: [],
        dimensions: [],
      };
    }

    return {
      primaryAggType: metricData.primaryAggregationType,
      supportedAggTypes: metricData.supportedAggregationTypes || defaultAggTypes,

      supportedTimeGrains: [
        { label: 'Auto', value: 'auto' },
        ...ResponseParser.parseTimeGrains(metricData.metricAvailabilities ?? []),
      ],
      dimensions: ResponseParser.parseDimensions(metricData.dimensions ?? []),
    };
  }

  static parseTimeGrains(metricAvailabilities: AzureMonitorMetricAvailabilityMetadata[]): AzureMonitorOption[] {
    const timeGrains: AzureMonitorOption[] = [];

    if (!metricAvailabilities) {
      return timeGrains;
    }

    metricAvailabilities.forEach((avail) => {
      if (avail.timeGrain) {
        timeGrains.push({
          label: TimeGrainConverter.createTimeGrainFromISO8601Duration(avail.timeGrain),
          value: avail.timeGrain,
        });
      }
    });

    return timeGrains;
  }

  static parseDimensions(metadataDimensions: AzureMonitorLocalizedValue[]) {
    return metadataDimensions.map((dimension) => {
      return {
        label: dimension.localizedValue || dimension.value,
        value: dimension.value,
      };
    });
  }

  static parseSubscriptions(result: AzureAPIResponse<Subscription>): Array<{ text: string; value: string }> {
    const list: Array<{ text: string; value: string }> = [];

    if (!result) {
      return list;
    }

    const valueFieldName = 'subscriptionId';
    const textFieldName = 'displayName';
    for (let i = 0; i < result.value.length; i++) {
      if (!find(list, ['value', get(result.value[i], valueFieldName)])) {
        list.push({
          text: `${get(result.value[i], textFieldName)}`,
          value: get(result.value[i], valueFieldName),
        });
      }
    }

    return list;
  }

  static parseSubscriptionsForSelect(
    result?: FetchResponse<AzureAPIResponse<Subscription>>
  ): Array<{ label: string; value: string }> {
    const list: Array<{ label: string; value: string }> = [];

    if (!result) {
      return list;
    }

    const valueFieldName = 'subscriptionId';
    const textFieldName = 'displayName';
    for (let i = 0; i < result.data.value.length; i++) {
      if (!find(list, ['value', get(result.data.value[i], valueFieldName)])) {
        list.push({
          label: `${get(result.data.value[i], textFieldName)} - ${get(result.data.value[i], valueFieldName)}`,
          value: get(result.data.value[i], valueFieldName),
        });
      }
    }

    return list;
  }

  static parseLocations(result: AzureAPIResponse<Location>) {
    const locations: AzureMonitorLocations[] = [];

    if (!result) {
      return locations;
    }

    for (const location of result.value) {
      locations.push({ name: location.name, displayName: location.displayName, supportsLogs: undefined });
    }

    return locations;
  }
}
