import moment from 'moment';
import _ from 'lodash';
import TimeGrainConverter from '../time_grain_converter';

export default class ResponseParser {
  constructor(private results) {}

  parseQueryResult() {
    const data: any[] = [];
    for (let i = 0; i < this.results.length; i++) {
      for (let j = 0; j < this.results[i].result.data.value.length; j++) {
        for (let k = 0; k < this.results[i].result.data.value[j].timeseries.length; k++) {
          const alias = this.results[i].query.alias;
          data.push({
            target: ResponseParser.createTarget(
              this.results[i].result.data.value[j],
              this.results[i].result.data.value[j].timeseries[k].metadatavalues,
              alias
            ),
            datapoints: ResponseParser.convertDataToPoints(this.results[i].result.data.value[j].timeseries[k].data),
          });
        }
      }
    }
    return data;
  }

  static createTarget(data, metadatavalues, alias: string) {
    const resourceGroup = ResponseParser.parseResourceGroupFromId(data.id);
    const resourceName = ResponseParser.parseResourceNameFromId(data.id);
    const namespace = ResponseParser.parseNamespaceFromId(data.id, resourceName);
    if (alias) {
      const regex = /\{\{([\s\S]+?)\}\}/g;
      return alias.replace(regex, (match, g1, g2) => {
        const group = g1 || g2;

        if (group === 'resourcegroup') {
          return resourceGroup;
        } else if (group === 'namespace') {
          return namespace;
        } else if (group === 'resourcename') {
          return resourceName;
        } else if (group === 'metric') {
          return data.name.value;
        } else if (group === 'dimensionname') {
          return metadatavalues && metadatavalues.length > 0 ? metadatavalues[0].name.value : '';
        } else if (group === 'dimensionvalue') {
          return metadatavalues && metadatavalues.length > 0 ? metadatavalues[0].value : '';
        }

        return match;
      });
    }

    if (metadatavalues && metadatavalues.length > 0) {
      return `${resourceName}{${metadatavalues[0].name.value}=${metadatavalues[0].value}}.${data.name.value}`;
    }

    return `${resourceName}.${data.name.value}`;
  }

  static parseResourceGroupFromId(id: string) {
    const startIndex = id.indexOf('/resourceGroups/') + 16;
    const endIndex = id.indexOf('/providers');

    return id.substring(startIndex, endIndex);
  }

  static parseNamespaceFromId(id: string, resourceName: string) {
    const startIndex = id.indexOf('/providers/') + 11;
    const endIndex = id.indexOf('/' + resourceName);

    return id.substring(startIndex, endIndex);
  }

  static parseResourceNameFromId(id: string) {
    const endIndex = id.lastIndexOf('/providers');
    const startIndex = id.slice(0, endIndex).lastIndexOf('/') + 1;

    return id.substring(startIndex, endIndex);
  }

  static convertDataToPoints(timeSeriesData) {
    const dataPoints: any[] = [];

    for (let k = 0; k < timeSeriesData.length; k++) {
      const epoch = ResponseParser.dateTimeToEpoch(timeSeriesData[k].timeStamp);
      const aggKey = ResponseParser.getKeyForAggregationField(timeSeriesData[k]);

      if (aggKey) {
        dataPoints.push([timeSeriesData[k][aggKey], epoch]);
      }
    }

    return dataPoints;
  }

  static dateTimeToEpoch(dateTime) {
    return moment(dateTime).valueOf();
  }

  static getKeyForAggregationField(dataObj): string {
    const keys = _.keys(dataObj);
    if (keys.length < 2) {
      return '';
    }

    return _.intersection(keys, ['total', 'average', 'maximum', 'minimum', 'count'])[0];
  }

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
}
