///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import TimeSeries from '../../../core/time_series2';
import {MetricsPanelCtrl} from '../../../features/panel/panel';

// Set and populate defaults
var panelDefaults = {
  links: [],
  datasource: null,
  maxDataPoints: 100,
  interval: null,
  targets: [{}],
  cacheTimeout: null,
  format: 'none',
  prefix: '',
  postfix: '',
  nullText: null,
  valueMaps: [
    { value: 'null', op: '=', text: 'N/A' }
  ],
  nullPointMode: 'connected',
  valueName: 'avg',
  prefixFontSize: '50%',
  valueFontSize: '80%',
  postfixFontSize: '50%',
  thresholds: '',
  colorBackground: false,
  colorValue: false,
  colors: ["rgba(245, 54, 54, 0.9)", "rgba(237, 129, 40, 0.89)", "rgba(50, 172, 45, 0.97)"],
  sparkline: {
    show: false,
    full: false,
    lineColor: 'rgb(31, 120, 193)',
    fillColor: 'rgba(31, 118, 189, 0.18)',
  }
};

export class SingleStatCtrl extends MetricsPanelCtrl {
  series: any[];
  data: any[];
  fontSizes: any[];
  unitFormats: any[];

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
    _.defaults(this.panel, panelDefaults);
  }


  initEditMode() {
    super.initEditMode();
    this.icon =  "fa fa-dashboard";
    this.fontSizes = ['20%', '30%','50%','70%','80%','100%', '110%', '120%', '150%', '170%', '200%'];
    this.addEditorTab('Options', 'app/plugins/panel/singlestat/editor.html', 2);
    this.unitFormats = kbn.getUnitFormats();
  }

  setUnitFormat(subItem) {
    this.panel.format = subItem.value;
    this.render();
  }

  refreshData(datasource) {
    return this.issueQueries(datasource)
      .then(this.dataHandler.bind(this))
      .catch(err => {
        this.series = [];
        this.render();
        throw err;
      });
  }

  loadSnapshot(snapshotData) {
    this.updateTimeRange();
    this.dataHandler(snapshotData);
  }

  dataHandler(results) {
    this.series = _.map(results.data, this.seriesHandler.bind(this));
    this.render();
  }

  seriesHandler(seriesData) {
    var series = new TimeSeries({
      datapoints: seriesData.datapoints,
      alias: seriesData.target,
    });

    series.flotpairs = series.getFlotPairs(this.panel.nullPointMode);
    return series;
  }

  setColoring(options) {
    if (options.background) {
      this.panel.colorValue = false;
      this.panel.colors = ['rgba(71, 212, 59, 0.4)', 'rgba(245, 150, 40, 0.73)', 'rgba(225, 40, 40, 0.59)'];
    } else {
      this.panel.colorBackground = false;
      this.panel.colors = ['rgba(50, 172, 45, 0.97)', 'rgba(237, 129, 40, 0.89)', 'rgba(245, 54, 54, 0.9)'];
    }
    this.render();
  }

  invertColorOrder() {
    var tmp = this.panel.colors[0];
    this.panel.colors[0] = this.panel.colors[2];
    this.panel.colors[2] = tmp;
    this.render();
  }

  getDecimalsForValue(value) {
    if (_.isNumber(this.panel.decimals)) {
      return {decimals: this.panel.decimals, scaledDecimals: null};
    }

    var delta = value / 2;
    var dec = -Math.floor(Math.log(delta) / Math.LN10);

    var magn = Math.pow(10, -dec),
      norm = delta / magn, // norm is between 1.0 and 10.0
      size;

    if (norm < 1.5) {
      size = 1;
    } else if (norm < 3) {
      size = 2;
      // special case for 2.5, requires an extra decimal
      if (norm > 2.25) {
        size = 2.5;
        ++dec;
      }
    } else if (norm < 7.5) {
      size = 5;
    } else {
      size = 10;
    }

    size *= magn;

    // reduce starting decimals if not needed
    if (Math.floor(value) === value) { dec = 0; }

    var result: any = {};
    result.decimals = Math.max(0, dec);
    result.scaledDecimals = result.decimals - Math.floor(Math.log(size) / Math.LN10) + 2;

    return result;
  }

  render() {
    var data: any = {};
    this.setValues(data);

    data.thresholds = this.panel.thresholds.split(',').map(function(strVale) {
      return Number(strVale.trim());
    });

    data.colorMap = this.panel.colors;

    this.data = data;
    this.broadcastRender();
  }

  setValues(data) {
    data.flotpairs = [];

    if (this.series.length > 1) {
      this.inspector.error = new Error();
      this.inspector.error.message = 'Multiple Series Error';
      this.inspector.error.data = 'Metric query returns ' + this.series.length +
        ' series. Single Stat Panel expects a single series.\n\nResponse:\n'+JSON.stringify(this.series);
      throw this.inspector.error;
    }

    if (this.series && this.series.length > 0) {
      var lastPoint = _.last(this.series[0].datapoints);
      var lastValue = _.isArray(lastPoint) ? lastPoint[0] : null;

      if (_.isString(lastValue)) {
        data.value = 0;
        data.valueFormated = lastValue;
        data.valueRounded = 0;
      } else {
        data.value = this.series[0].stats[this.panel.valueName];
        data.flotpairs = this.series[0].flotpairs;

        var decimalInfo = this.getDecimalsForValue(data.value);
        var formatFunc = kbn.valueFormats[this.panel.format];
        data.valueFormated = formatFunc(data.value, decimalInfo.decimals, decimalInfo.scaledDecimals);
        data.valueRounded = kbn.roundValue(data.value, decimalInfo.decimals);
      }
    }

    // check value to text mappings
    for (var i = 0; i < this.panel.valueMaps.length; i++) {
      var map = this.panel.valueMaps[i];
      // special null case
      if (map.value === 'null') {
        if (data.value === null || data.value === void 0) {
          data.valueFormated = map.text;
          return;
        }
        continue;
      }

      // value/number to text mapping
      var value = parseFloat(map.value);
      if (value === data.value) {
        data.valueFormated = map.text;
        return;
      }
    }

    if (data.value === null || data.value === void 0) {
      data.valueFormated = "no value";
    }
  };

  removeValueMap(map) {
    var index = _.indexOf(this.panel.valueMaps, map);
    this.panel.valueMaps.splice(index, 1);
    this.render();
  };

  addValueMap() {
    this.panel.valueMaps.push({value: '', op: '=', text: '' });
  }
}

