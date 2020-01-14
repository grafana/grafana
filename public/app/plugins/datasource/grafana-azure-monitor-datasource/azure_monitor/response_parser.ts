import _ from 'lodash';
import TimeGrainConverter from '../time_grain_converter';
export default class ResponseParser {
  static parseResponseValues(
    result: any,
    textFieldName: string,
    valueFieldName: string
  ): Array<{ text: string; value: string }> {
    const list: Array<{ text: string; value: string }> = [];

    if (!result) {
      return list;
    }

    for (let i = 0; i < result.data.value.length; i++) {
      if (!_.find(list, ['value', _.get(result.data.value[i], valueFieldName)])) {
        const value = _.get(result.data.value[i], valueFieldName);
        const text = _.get(result.data.value[i], textFieldName, value);

        list.push({
          text: text,
          value: value,
        });
      }
    }
    return list;
  }

  static parseResourceNames(result: any, metricDefinition: string): Array<{ text: string; value: string }> {
    const list: Array<{ text: string; value: string }> = [];

    if (!result) {
      return list;
    }

    for (let i = 0; i < result.data.value.length; i++) {
      if (result.data.value[i].type === metricDefinition) {
        list.push({
          text: result.data.value[i].name,
          value: result.data.value[i].name,
        });
      }
    }

    return list;
  }

  static parseMetadata(result: any, metricName: string) {
    const defaultAggTypes = ['None', 'Average', 'Minimum', 'Maximum', 'Total', 'Count'];

    if (!result) {
      return {
        primaryAggType: '',
        supportedAggTypes: defaultAggTypes,
        supportedTimeGrains: [],
        dimensions: [],
      };
    }

    const metricData: any = _.find(result.data.value, o => {
      return _.get(o, 'name.value') === metricName;
    });

    return {
      primaryAggType: metricData.primaryAggregationType,
      supportedAggTypes: metricData.supportedAggregationTypes || defaultAggTypes,
      supportedTimeGrains: ResponseParser.parseTimeGrains(metricData.metricAvailabilities || []),
      dimensions: ResponseParser.parseDimensions(metricData),
    };
  }

  static parseTimeGrains(metricAvailabilities: any[]): Array<{ text: string; value: string }> {
    const timeGrains: any[] = [];
    if (!metricAvailabilities) {
      return timeGrains;
    }

    metricAvailabilities.forEach(avail => {
      if (avail.timeGrain) {
        timeGrains.push({
          text: TimeGrainConverter.createTimeGrainFromISO8601Duration(avail.timeGrain),
          value: avail.timeGrain,
        });
      }
    });
    return timeGrains;
  }

  static parseDimensions(metricData: any): Array<{ text: string; value: string }> {
    const dimensions: Array<{ text: string; value: string }> = [];
    if (!metricData.dimensions || metricData.dimensions.length === 0) {
      return dimensions;
    }

    if (!metricData.isDimensionRequired) {
      dimensions.push({ text: 'None', value: 'None' });
    }

    for (let i = 0; i < metricData.dimensions.length; i++) {
      const text = metricData.dimensions[i].localizedValue;
      const value = metricData.dimensions[i].value;

      dimensions.push({
        text: !text ? value : text,
        value: value,
      });
    }
    return dimensions;
  }

  static parseSubscriptions(result: any): Array<{ text: string; value: string }> {
    const list: Array<{ text: string; value: string }> = [];

    if (!result) {
      return list;
    }

    const valueFieldName = 'subscriptionId';
    const textFieldName = 'displayName';
    for (let i = 0; i < result.data.value.length; i++) {
      if (!_.find(list, ['value', _.get(result.data.value[i], valueFieldName)])) {
        list.push({
          text: `${_.get(result.data.value[i], textFieldName)} - ${_.get(result.data.value[i], valueFieldName)}`,
          value: _.get(result.data.value[i], valueFieldName),
        });
      }
    }

    return list;
  }

  static parseSubscriptionsForSelect(result: any): Array<{ label: string; value: string }> {
    const list: Array<{ label: string; value: string }> = [];

    if (!result) {
      return list;
    }

    const valueFieldName = 'subscriptionId';
    const textFieldName = 'displayName';
    for (let i = 0; i < result.data.value.length; i++) {
      if (!_.find(list, ['value', _.get(result.data.value[i], valueFieldName)])) {
        list.push({
          label: `${_.get(result.data.value[i], textFieldName)} - ${_.get(result.data.value[i], valueFieldName)}`,
          value: _.get(result.data.value[i], valueFieldName),
        });
      }
    }

    return list;
  }

  static parseWorkspacesForSelect(result: any): Array<{ label: string; value: string }> {
    const list: Array<{ label: string; value: string }> = [];

    if (!result) {
      return list;
    }

    const valueFieldName = 'customerId';
    const textFieldName = 'name';
    for (let i = 0; i < result.data.value.length; i++) {
      if (!_.find(list, ['value', _.get(result.data.value[i].properties, valueFieldName)])) {
        list.push({
          label: _.get(result.data.value[i], textFieldName),
          value: _.get(result.data.value[i].properties, valueFieldName),
        });
      }
    }

    return list;
  }
}
