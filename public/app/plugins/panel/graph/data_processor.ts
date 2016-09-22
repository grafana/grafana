///<reference path="../../../headers/common.d.ts" />

import kbn from 'app/core/utils/kbn';
import _ from 'lodash';
import TimeSeries from 'app/core/time_series2';
import {colors} from 'app/core/core';

export class DataProcessor {

  constructor(private panel) {
  }

  getSeriesList(options) {

    switch (this.panel.xaxis.mode) {
      case 'series':
      case 'time': {
        return options.dataList.map(this.timeSeriesHandler.bind(this));
      }
      case 'table': {
         // Table panel uses only first enabled target, so we can use dataList[0]
         // dataList.splice(1, dataList.length - 1);
         // dataHandler = this.tableHandler;
        break;
      }
      case 'json': {
        break;
      }
    }
  }

  seriesHandler(seriesData, index, datapoints, alias) {
    var colorIndex = index % colors.length;
    var color = this.panel.aliasColors[alias] || colors[colorIndex];

    var series = new TimeSeries({datapoints: datapoints, alias: alias, color: color, unit: seriesData.unit});

    // if (datapoints && datapoints.length > 0) {
    //   var last = moment.utc(datapoints[datapoints.length - 1][1]);
    //   var from = moment.utc(this.range.from);
    //   if (last - from < -10000) {
    //     this.datapointsOutside = true;
    //   }
    //
    //   this.datapointsCount += datapoints.length;
    //   this.panel.tooltip.msResolution = this.panel.tooltip.msResolution || series.isMsResolutionNeeded();
    // }

    return series;
  }

  timeSeriesHandler(seriesData, index) {
    var datapoints = seriesData.datapoints;
    var alias = seriesData.target;

    return this.seriesHandler(seriesData, index, datapoints, alias);
  }

  tableHandler(seriesData, index) {
    var xColumnIndex = Number(this.panel.xaxis.columnIndex);
    var valueColumnIndex = Number(this.panel.xaxis.valueColumnIndex);
    var datapoints = _.map(seriesData.rows, (row) => {
      var value = valueColumnIndex ? row[valueColumnIndex] : _.last(row);
      return [
        value,             // Y value
        row[xColumnIndex]  // X value
      ];
    });

    var alias = seriesData.columns[valueColumnIndex].text;

    return this.seriesHandler(seriesData, index, datapoints, alias);
  }

  // esRawDocHandler(seriesData, index) {
  //   let xField = this.panel.xaxis.esField;
  //   let valueField = this.panel.xaxis.esValueField;
  //   let datapoints = _.map(seriesData.datapoints, (doc) => {
  //     return [
  //       pluckDeep(doc, valueField),  // Y value
  //       pluckDeep(doc, xField)       // X value
  //     ];
  //   });
  //
  //   // Remove empty points
  //   datapoints = _.filter(datapoints, (point) => {
  //     return point[0] !== undefined;
  //   });
  //
  //   var alias = valueField;
  //   return this.seriesHandler(seriesData, index, datapoints, alias);
  // }
  //
  validateXAxisSeriesValue() {
    switch (this.panel.xaxis.mode) {
      case 'series': {
        if (this.panel.xaxis.values.length === 0) {
          this.panel.xaxis.values = ['total'];
          return;
        }

        var validOptions = this.getXAxisValueOptions({});
        var found = _.find(validOptions, {value: this.panel.xaxis.values[0]});
        if (!found) {
          this.panel.xaxis.values = ['total'];
        }
        return;
      }
    }
  }

  getXAxisValueOptions(options) {
    switch (this.panel.xaxis.mode) {
      case 'time': {
        return [];
      }
      case 'series': {
        return [
          {text: 'Avg', value: 'avg'},
          {text: 'Min', value: 'min'},
          {text: 'Max', value: 'min'},
          {text: 'Total', value: 'total'},
          {text: 'Count', value: 'count'},
        ];
      }
    }
  }
}

// function getFieldsFromESDoc(doc) {
//   let fields = [];
//   let fieldNameParts = [];
//
//   function getFieldsRecursive(obj) {
//     _.forEach(obj, (value, key) => {
//       if (_.isObject(value)) {
//         fieldNameParts.push(key);
//         getFieldsRecursive(value);
//       } else {
//         let field = fieldNameParts.concat(key).join('.');
//         fields.push(field);
//       }
//     });
//     fieldNameParts.pop();
//   }
//
//   getFieldsRecursive(doc);
//   return fields;
// }
//
// function pluckDeep(obj: any, property: string) {
//   let propertyParts = property.split('.');
//   let value = obj;
//   for (let i = 0; i < propertyParts.length; ++i) {
//     if (value[propertyParts[i]]) {
//       value = value[propertyParts[i]];
//     } else {
//       return undefined;
//     }
//   }
//   return value;
// }


