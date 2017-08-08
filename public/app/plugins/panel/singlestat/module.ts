///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';
import 'jquery.flot';

import kbn from 'app/core/utils/kbn';
import TimeSeries from 'app/core/time_series2';
import {MetricsPanelCtrl} from 'app/plugins/sdk';

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

class SingleStatCtrl extends MetricsPanelCtrl {
  static templateUrl = 'module.html';

  series: any[];
  data: any;
  fontSizes: any[];
  unitFormats: any[];

  /** @ngInject */
  constructor($scope, $injector, private $location, private linkSrv) {
    super($scope, $injector);
    _.defaults(this.panel, panelDefaults);

    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
  }

  onInitEditMode() {
    this.fontSizes = ['20%', '30%','50%','70%','80%','100%', '110%', '120%', '150%', '170%', '200%'];
    this.addEditorTab('Options', 'public/app/plugins/panel/singlestat/editor.html', 2);
    this.unitFormats = kbn.getUnitFormats();
  }

  setUnitFormat(subItem) {
    this.panel.format = subItem.value;
    this.render();
  }

  onDataError(err) {
    this.onDataReceived({data: []});
  }

  onDataReceived(dataList) {
    this.series = dataList.map(this.seriesHandler.bind(this));

    var data: any = {};
    this.setValues(data);

    data.thresholds = this.panel.thresholds.split(',').map(function(strVale) {
      return Number(strVale.trim());
    });

    data.colorMap = this.panel.colors;
    this.data = data;
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

  setValues(data) {
    data.flotpairs = [];

    if (this.series.length > 1) {
      var error: any = new Error();
      error.message = 'Multiple Series Error';
      error.data = 'Metric query returns ' + this.series.length +
        ' series. Single Stat Panel expects a single series.\n\nResponse:\n'+JSON.stringify(this.series);
      throw error;
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
      var dataValue = parseFloat(data.valueFormated);
      if (value === dataValue) {
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

  link(scope, elem, attrs, ctrl) {
    var $location = this.$location;
    var linkSrv = this.linkSrv;
    var $timeout = this.$timeout;
    var panel = ctrl.panel;
    var templateSrv = this.templateSrv;
    var data, linkInfo;
    var $panelContainer = elem.find('.panel-container');
    elem = elem.find('.singlestat-panel');

    function setElementHeight() {
      elem.css('height', ctrl.height + 'px');
    }

    function applyColoringThresholds(value, valueString) {
      if (!panel.colorValue) {
        return valueString;
      }

      var color = getColorForValue(data, value);
      if (color) {
        return '<span style="color:' + color + '">'+ valueString + '</span>';
      }

      return valueString;
    }

    function getSpan(className, fontSize, value)  {
      value = templateSrv.replace(value);
      return '<span class="' + className + '" style="font-size:' + fontSize + '">' +
        value + '</span>';
    }

    function getBigValueHtml() {
      var body = '<div class="singlestat-panel-value-container">';

      if (panel.prefix) { body += getSpan('singlestat-panel-prefix', panel.prefixFontSize, panel.prefix); }

      var value = applyColoringThresholds(data.value, data.valueFormated);
      body += getSpan('singlestat-panel-value', panel.valueFontSize, value);

      if (panel.postfix) { body += getSpan('singlestat-panel-postfix', panel.postfixFontSize, panel.postfix); }

      body += '</div>';

      return body;
    }

    function addSparkline() {
      var width = elem.width() + 20;
      if (width < 30) {
        // element has not gotten it's width yet
        // delay sparkline render
        setTimeout(addSparkline, 30);
        return;
      }

      var height = ctrl.height;
      var plotCanvas = $('<div></div>');
      var plotCss: any = {};
      plotCss.position = 'absolute';

      if (panel.sparkline.full) {
        plotCss.bottom = '5px';
        plotCss.left = '-5px';
        plotCss.width = (width - 10) + 'px';
        var dynamicHeightMargin = height <= 100 ? 5 : (Math.round((height/100)) * 15) + 5;
        plotCss.height = (height - dynamicHeightMargin) + 'px';
      } else {
        plotCss.bottom = "0px";
        plotCss.left = "-5px";
        plotCss.width = (width - 10) + 'px';
        plotCss.height = Math.floor(height * 0.25) + "px";
      }

      plotCanvas.css(plotCss);

      var options = {
        legend: { show: false },
        series: {
          lines:  {
            show: true,
            fill: 1,
            lineWidth: 1,
            fillColor: panel.sparkline.fillColor,
          },
        },
        yaxes: { show: false },
        xaxis: {
          show: false,
          mode: "time",
          min: ctrl.range.from.valueOf(),
          max: ctrl.range.to.valueOf(),
        },
        grid: { hoverable: false, show: false },
      };

      elem.append(plotCanvas);

      var plotSeries = {
        data: data.flotpairs,
        color: panel.sparkline.lineColor
      };

      $.plot(plotCanvas, [plotSeries], options);
    }

    function render() {
      if (!ctrl.data) { return; }

      data = ctrl.data;
      setElementHeight();

      var body = getBigValueHtml();

      if (panel.colorBackground && !isNaN(data.valueRounded)) {
        var color = getColorForValue(data, data.valueRounded);
        if (color) {
          $panelContainer.css('background-color', color);
          if (scope.fullscreen) {
            elem.css('background-color', color);
          } else {
            elem.css('background-color', '');
          }
        }
      } else {
        $panelContainer.css('background-color', '');
        elem.css('background-color', '');
      }

      elem.html(body);

      if (panel.sparkline.show) {
        addSparkline();
      }

      elem.toggleClass('pointer', panel.links.length > 0);

      if (panel.links.length > 0) {
        linkInfo = linkSrv.getPanelLinkAnchorInfo(panel.links[0], panel.scopedVars);
      } else {
        linkInfo = null;
      }
    }

    function hookupDrilldownLinkTooltip() {
      // drilldown link tooltip
      var drilldownTooltip = $('<div id="tooltip" class="">hello</div>"');

      elem.mouseleave(function() {
        if (panel.links.length === 0) { return;}
        drilldownTooltip.detach();
      });

      elem.click(function(evt) {
        if (!linkInfo) { return; }
        // ignore title clicks in title
        if ($(evt).parents('.panel-header').length > 0) { return; }

        if (linkInfo.target === '_blank') {
          var redirectWindow = window.open(linkInfo.href, '_blank');
          redirectWindow.location;
          return;
        }

        if (linkInfo.href.indexOf('http') === 0) {
          window.location.href = linkInfo.href;
        } else {
          $timeout(function() {
            $location.url(linkInfo.href);
          });
        }

        drilldownTooltip.detach();
      });

      elem.mousemove(function(e) {
        if (!linkInfo) { return;}

        drilldownTooltip.text('click to go to: ' + linkInfo.title);
        drilldownTooltip.place_tt(e.pageX+20, e.pageY-15);
      });
    }

    hookupDrilldownLinkTooltip();

    this.events.on('render', function() {
      render();
      ctrl.renderingCompleted();
    });
  }
}

function getColorForValue(data, value) {
  for (var i = data.thresholds.length; i > 0; i--) {
    if (value >= data.thresholds[i-1]) {
      return data.colorMap[i];
    }
  }
  return _.first(data.colorMap);
}

export {
  SingleStatCtrl,
  SingleStatCtrl as PanelCtrl,
  getColorForValue
};
