import _ from 'lodash';
import TimeGrainConverter from '../time_grain_converter';
export default class ResponseParser {
  static parseResponseValues(result: any, textFieldName: string, valueFieldName: string) {
    const list: any[] = [];
    for (let i = 0; i < result.data.value.length; i++) {
      if (!_.find(list, ['value', _.get(result.data.value[i], valueFieldName)])) {
        list.push({
          text: _.get(result.data.value[i], textFieldName),
          value: _.get(result.data.value[i], valueFieldName),
        });
      }
    }
    return list;
  }

  static parseResourceNames(result: any, metricDefinition: string) {
    const list: any[] = [];
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
    const metricData: any = _.find(result.data.value, o => {
      return _.get(o, 'name.value') === metricName;
    });

    const defaultAggTypes = ['None', 'Average', 'Minimum', 'Maximum', 'Total', 'Count'];

    return {
      primaryAggType: metricData.primaryAggregationType,
      supportedAggTypes: metricData.supportedAggregationTypes || defaultAggTypes,
      supportedTimeGrains: ResponseParser.parseTimeGrains(metricData.metricAvailabilities || []),
      dimensions: ResponseParser.parseDimensions(metricData),
    };
  }

  static parseTimeGrains(metricAvailabilities) {
    const timeGrains: any[] = [];
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

  static parseDimensions(metricData: any) {
    const dimensions: any[] = [];
    if (!metricData.dimensions || metricData.dimensions.length === 0) {
      return dimensions;
    }

    if (!metricData.isDimensionRequired) {
      dimensions.push({ text: 'None', value: 'None' });
    }

    for (let i = 0; i < metricData.dimensions.length; i++) {
      dimensions.push({
        text: metricData.dimensions[i].localizedValue,
        value: metricData.dimensions[i].value,
      });
    }
    return dimensions;
  }

  static parseSubscriptions(result: any) {
    const valueFieldName = 'subscriptionId';
    const textFieldName = 'displayName';
    const list: Array<{ text: string; value: string }> = [];
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
}
