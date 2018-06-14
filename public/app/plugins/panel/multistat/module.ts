import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import React from 'react';
import ReactDOM from 'react-dom';
import { MultiStat } from './components/MultiStat';
import TimeSeries from 'app/core/time_series2';
import { getDecimalsForValue } from 'app/core/utils/ticks';
import defaults from './defaults';
import { MetricsPanelCtrl } from 'app/plugins/sdk';
import './components/MultiStat';

class MultiStatCtrl extends MetricsPanelCtrl {
  static templateUrl = 'module.html';

  dataType = 'timeseries';
  series: any[];
  data: any;
  tableColumnOptions: any;

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);

    _.defaults(this.panel, defaults.panelDefaults);

    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
    // this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
  }

  onDataReceived(dataList) {
    if (dataList.length > 0 && dataList[0].type === 'table') {
      this.dataType = 'table';
      const tableData = dataList.map(this.tableHandler.bind(this));
      this.setTableValues(tableData);
    } else {
      this.dataType = 'timeseries';
      this.series = dataList.map(this.seriesHandler.bind(this));
      this.setValues();
    }
    // this.data = data;
    this.render();
  }

  onDataError(err) {
    this.onDataReceived([]);
  }

  seriesHandler(seriesData) {
    var series = new TimeSeries({
      datapoints: seriesData.datapoints || [],
      alias: seriesData.target,
    });

    series.flotpairs = series.getFlotPairs(this.panel.nullPointMode);
    return series;
  }

  tableHandler(tableData) {
    const datapoints = [];
    const columnNames = {};

    tableData.columns.forEach((column, columnIndex) => {
      columnNames[columnIndex] = column.text;
    });

    this.tableColumnOptions = columnNames;
    if (!_.find(tableData.columns, ['text', this.panel.tableColumn])) {
      this.setTableColumnToSensibleDefault(tableData);
    }

    tableData.rows.forEach(row => {
      const datapoint = {};

      row.forEach((value, columnIndex) => {
        const key = columnNames[columnIndex];
        datapoint[key] = value;
      });

      datapoints.push(datapoint);
    });

    return datapoints;
  }

  setValues() {
    let panelData: any = [];

    for (let series of this.series) {
      let data: any = {};
      data.flotpairs = [];
      data.label = series.label;
      data.alias = series.alias;
      let lastPoint = _.last(series.datapoints);
      let lastValue = _.isArray(lastPoint) ? lastPoint[0] : null;

      if (this.panel.valueName === 'name') {
        data.value = 0;
        data.valueRounded = 0;
        data.valueFormatted = series.alias;
      } else if (_.isString(lastValue)) {
        data.value = 0;
        data.valueFormatted = _.escape(lastValue);
        data.valueRounded = 0;
      } else if (this.panel.valueName === 'last_time') {
        let formatFunc = kbn.valueFormats[this.panel.format];
        data.value = lastPoint[1];
        data.valueRounded = data.value;
        data.valueFormatted = formatFunc(data.value, this.dashboard.isTimezoneUtc());
      } else {
        data.value = series.stats[this.panel.valueName];
        data.flotpairs = series.flotpairs;

        let decimalInfo = getDecimalsForValue(data.value);
        let formatFunc = kbn.valueFormats[this.panel.format];
        data.valueFormatted = formatFunc(data.value, decimalInfo.decimals, decimalInfo.scaledDecimals);
        data.valueRounded = kbn.roundValue(data.value, decimalInfo.decimals);
      }

      // Add $__name variable for using in prefix or postfix
      data.scopedVars = _.extend({}, this.panel.scopedVars);
      data.scopedVars['__name'] = { value: series.label };
      this.setValueMapping(data);
      panelData.push(data);
    }

    this.data = panelData;
    return panelData;
  }

  setTableValues(tableData) {
    let data: any = [];

    if (!tableData || tableData.length === 0) {
      return;
    }

    if (tableData[0].length === 0 || tableData[0][0][this.panel.tableColumn] === undefined) {
      return;
    }

    const datapoint = tableData[0][0];
    data.value = datapoint[this.panel.tableColumn];

    if (_.isString(data.value)) {
      data.valueFormatted = _.escape(data.value);
      data.value = 0;
      data.valueRounded = 0;
    } else {
      const decimalInfo = getDecimalsForValue(data.value);
      const formatFunc = kbn.valueFormats[this.panel.format];
      data.valueFormatted = formatFunc(
        datapoint[this.panel.tableColumn],
        decimalInfo.decimals,
        decimalInfo.scaledDecimals
      );
      data.valueRounded = kbn.roundValue(data.value, this.panel.decimals || 0);
    }

    this.setValueMapping(data);
    this.data = data;
  }

  setTableColumnToSensibleDefault(tableData) {
    if (tableData.columns.length === 1) {
      this.panel.tableColumn = tableData.columns[0].text;
    } else {
      this.panel.tableColumn = _.find(tableData.columns, col => {
        return col.type !== 'time';
      }).text;
    }
  }

  setValueMapping(data) {}

  link(scope, elem, attrs, ctrl) {
    const multistatElem = elem.find('.multistat-panel');

    function render() {
      if (!ctrl.data) {
        return;
      }

      scope.width = multistatElem.width();
      renderMultiStatComponent();
    }

    function renderMultiStatComponent() {
      const multistatProps = {
        stats: ctrl.data,
        options: ctrl.panel,
        width: scope.width,
      };
      const multistatReactElem = React.createElement(MultiStat, multistatProps);
      ReactDOM.render(multistatReactElem, multistatElem[0]);
    }

    this.events.on('render', function() {
      render();
      ctrl.renderingCompleted();
    });

    // cleanup when scope is destroyed
    scope.$on('$destroy', () => {
      ReactDOM.unmountComponentAtNode(multistatElem[0]);
    });
  }
}

export { MultiStatCtrl, MultiStatCtrl as PanelCtrl };
