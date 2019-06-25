import _ from 'lodash';
import $ from 'jquery';
import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.gauge';
import 'app/features/panel/panellinks/link_srv';
import { getDecimalsForValue } from '@grafana/ui';

import kbn from 'app/core/utils/kbn';
import config from 'app/core/config';
import TimeSeries from 'app/core/time_series2';
import { MetricsPanelCtrl } from 'app/plugins/sdk';
import { GrafanaThemeType, getValueFormat, getColorFromHexRgbOrName, isTableData } from '@grafana/ui';
import { auto } from 'angular';
import { LinkSrv } from 'app/features/panel/panellinks/link_srv';
import TableModel from 'app/core/table_model';

const BASE_FONT_SIZE = 38;

interface DataFormat {
  value: string | number;
  valueFormatted: string;
  valueRounded: number;
}

class SingleStatCtrl extends MetricsPanelCtrl {
  static templateUrl = 'module.html';

  dataType = 'timeseries';
  series: any[];
  data: any;
  fontSizes: any[];
  unitFormats: any[];
  invalidGaugeRange: boolean;
  panel: any;
  events: any;
  valueNameOptions: any[] = [
    { value: 'min', text: 'Min' },
    { value: 'max', text: 'Max' },
    { value: 'avg', text: 'Average' },
    { value: 'current', text: 'Current' },
    { value: 'total', text: 'Total' },
    { value: 'name', text: 'Name' },
    { value: 'first', text: 'First' },
    { value: 'delta', text: 'Delta' },
    { value: 'diff', text: 'Difference' },
    { value: 'range', text: 'Range' },
    { value: 'last_time', text: 'Time of last point' },
  ];
  tableColumnOptions: any;

  // Set and populate defaults
  panelDefaults: any = {
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
    valueMaps: [{ value: 'null', op: '=', text: 'N/A' }],
    mappingTypes: [{ name: 'value to text', value: 1 }, { name: 'range to text', value: 2 }],
    rangeMaps: [{ from: 'null', to: 'null', text: 'N/A' }],
    mappingType: 1,
    nullPointMode: 'connected',
    valueName: 'avg',
    prefixFontSize: '50%',
    valueFontSize: '80%',
    postfixFontSize: '50%',
    thresholds: '',
    colorBackground: false,
    colorValue: false,
    colors: ['#299c46', 'rgba(237, 129, 40, 0.89)', '#d44a3a'],
    sparkline: {
      show: false,
      full: false,
      ymin: null,
      ymax: null,
      lineColor: 'rgb(31, 120, 193)',
      fillColor: 'rgba(31, 118, 189, 0.18)',
    },
    gauge: {
      show: false,
      minValue: 0,
      maxValue: 100,
      thresholdMarkers: true,
      thresholdLabels: false,
    },
    tableColumn: '',
  };

  /** @ngInject */
  constructor($scope: any, $injector: auto.IInjectorService, private linkSrv: LinkSrv, private $sanitize: any) {
    super($scope, $injector);
    _.defaults(this.panel, this.panelDefaults);

    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));

    this.onSparklineColorChange = this.onSparklineColorChange.bind(this);
    this.onSparklineFillChange = this.onSparklineFillChange.bind(this);
  }

  onInitEditMode() {
    this.fontSizes = ['20%', '30%', '50%', '70%', '80%', '100%', '110%', '120%', '150%', '170%', '200%'];
    this.addEditorTab('Options', 'public/app/plugins/panel/singlestat/editor.html', 2);
    this.addEditorTab('Value Mappings', 'public/app/plugins/panel/singlestat/mappings.html', 3);
    this.unitFormats = kbn.getUnitFormats();
  }

  setUnitFormat(subItem: { value: any }) {
    this.panel.format = subItem.value;
    this.refresh();
  }

  onDataError(err: any) {
    this.onDataReceived([]);
  }

  onDataReceived(dataList: any[]) {
    const data: any = {
      scopedVars: _.extend({}, this.panel.scopedVars),
    };

    if (dataList.length > 0 && isTableData(dataList[0])) {
      this.dataType = 'table';
      const tableData = dataList.map(this.tableHandler.bind(this));
      this.setTableValues(tableData, data);
    } else {
      this.dataType = 'timeseries';
      this.series = dataList.map(this.seriesHandler.bind(this));
      this.setValues(data);
    }

    this.data = data;
    this.render();
  }

  seriesHandler(seriesData: any) {
    const series = new TimeSeries({
      datapoints: seriesData.datapoints || [],
      alias: seriesData.target,
    });

    series.flotpairs = series.getFlotPairs(this.panel.nullPointMode);
    return series;
  }

  tableHandler(tableData: TableModel) {
    const datapoints: any[] = [];
    const columnNames: string[] = [];

    tableData.columns.forEach((column, columnIndex) => {
      columnNames[columnIndex] = column.text;
    });

    this.tableColumnOptions = columnNames;
    if (!_.find(tableData.columns, ['text', this.panel.tableColumn])) {
      this.setTableColumnToSensibleDefault(tableData);
    }

    tableData.rows.forEach(row => {
      const datapoint: any = {};

      row.forEach((value: any, columnIndex: number) => {
        const key = columnNames[columnIndex];
        datapoint[key] = value;
      });

      datapoints.push(datapoint);
    });

    return datapoints;
  }

  setTableColumnToSensibleDefault(tableData: TableModel) {
    if (tableData.columns.length === 1) {
      this.panel.tableColumn = tableData.columns[0].text;
    } else {
      this.panel.tableColumn = _.find(tableData.columns, col => {
        return col.type !== 'time';
      }).text;
    }
  }

  setTableValues(tableData: any[], data: DataFormat) {
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
      const decimalInfo = getDecimalsForValue(data.value, this.panel.decimals);
      const formatFunc = getValueFormat(this.panel.format);

      data.valueFormatted = formatFunc(
        datapoint[this.panel.tableColumn],
        decimalInfo.decimals,
        decimalInfo.scaledDecimals
      );
      data.valueRounded = kbn.roundValue(data.value, decimalInfo.decimals);
    }

    this.setValueMapping(data);
  }

  canModifyText() {
    return !this.panel.gauge.show;
  }

  setColoring(options: { background: any }) {
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
    const tmp = this.panel.colors[0];
    this.panel.colors[0] = this.panel.colors[2];
    this.panel.colors[2] = tmp;
    this.render();
  }

  onColorChange(panelColorIndex: number) {
    return (color: string) => {
      this.panel.colors[panelColorIndex] = color;
      this.render();
    };
  }

  onSparklineColorChange(newColor: string) {
    this.panel.sparkline.lineColor = newColor;
    this.render();
  }

  onSparklineFillChange(newColor: string) {
    this.panel.sparkline.fillColor = newColor;
    this.render();
  }

  setValues(data: any) {
    data.flotpairs = [];

    if (this.series.length > 1) {
      const error: any = new Error();
      error.message = 'Multiple Series Error';
      error.data =
        'Metric query returns ' +
        this.series.length +
        ' series. Single Stat Panel expects a single series.\n\nResponse:\n' +
        JSON.stringify(this.series);
      throw error;
    }

    if (this.series && this.series.length > 0) {
      const lastPoint: any = _.last(this.series[0].datapoints);
      const lastValue = _.isArray(lastPoint) ? lastPoint[0] : null;
      const formatFunc = getValueFormat(this.panel.format);

      if (this.panel.valueName === 'name') {
        data.value = 0;
        data.valueRounded = 0;
        data.valueFormatted = this.series[0].alias;
      } else if (_.isString(lastValue)) {
        data.value = 0;
        data.valueFormatted = _.escape(lastValue);
        data.valueRounded = 0;
      } else if (this.panel.valueName === 'last_time') {
        data.value = lastPoint[1];
        data.valueRounded = data.value;
        data.valueFormatted = formatFunc(data.value, 0, 0, this.dashboard.isTimezoneUtc());
      } else {
        data.value = this.series[0].stats[this.panel.valueName];
        data.flotpairs = this.series[0].flotpairs;

        const decimalInfo = getDecimalsForValue(data.value, this.panel.decimals);

        data.valueFormatted = formatFunc(
          data.value,
          decimalInfo.decimals,
          decimalInfo.scaledDecimals,
          this.dashboard.isTimezoneUtc()
        );
        data.valueRounded = kbn.roundValue(data.value, decimalInfo.decimals);
      }

      // Add $__name variable for using in prefix or postfix
      data.scopedVars['__name'] = { value: this.series[0].label };
    }
    this.setValueMapping(data);
  }

  setValueMapping(data: DataFormat) {
    // check value to text mappings if its enabled
    if (this.panel.mappingType === 1) {
      for (let i = 0; i < this.panel.valueMaps.length; i++) {
        const map = this.panel.valueMaps[i];
        // special null case
        if (map.value === 'null') {
          if (data.value === null || data.value === void 0) {
            data.valueFormatted = map.text;
            return;
          }
          continue;
        }

        // value/number to text mapping
        const value = parseFloat(map.value);
        if (value === data.valueRounded) {
          data.valueFormatted = map.text;
          return;
        }
      }
    } else if (this.panel.mappingType === 2) {
      for (let i = 0; i < this.panel.rangeMaps.length; i++) {
        const map = this.panel.rangeMaps[i];
        // special null case
        if (map.from === 'null' && map.to === 'null') {
          if (data.value === null || data.value === void 0) {
            data.valueFormatted = map.text;
            return;
          }
          continue;
        }

        // value/number to range mapping
        const from = parseFloat(map.from);
        const to = parseFloat(map.to);
        if (to >= data.valueRounded && from <= data.valueRounded) {
          data.valueFormatted = map.text;
          return;
        }
      }
    }

    if (data.value === null || data.value === void 0) {
      data.valueFormatted = 'no value';
    }
  }

  removeValueMap(map: any) {
    const index = _.indexOf(this.panel.valueMaps, map);
    this.panel.valueMaps.splice(index, 1);
    this.render();
  }

  addValueMap() {
    this.panel.valueMaps.push({ value: '', op: '=', text: '' });
  }

  removeRangeMap(rangeMap: any) {
    const index = _.indexOf(this.panel.rangeMaps, rangeMap);
    this.panel.rangeMaps.splice(index, 1);
    this.render();
  }

  addRangeMap() {
    this.panel.rangeMaps.push({ from: '', to: '', text: '' });
  }

  link(scope: any, elem: JQuery, attrs: any, ctrl: any) {
    const $location = this.$location;
    const linkSrv = this.linkSrv;
    const $timeout = this.$timeout;
    const $sanitize = this.$sanitize;
    const panel = ctrl.panel;
    const templateSrv = this.templateSrv;
    let data: any, linkInfo: { target: string; href: string; title: string };
    const $panelContainer = elem.find('.panel-container');
    elem = elem.find('.singlestat-panel');

    function applyColoringThresholds(valueString: string) {
      const color = getColorForValue(data, data.value);
      if (color) {
        return '<span style="color:' + color + '">' + valueString + '</span>';
      }

      return valueString;
    }

    function getSpan(className: string, fontSizePercent: string, applyColoring: any, value: string) {
      value = $sanitize(templateSrv.replace(value, data.scopedVars));
      value = applyColoring ? applyColoringThresholds(value) : value;
      const pixelSize = (parseInt(fontSizePercent, 10) / 100) * BASE_FONT_SIZE;
      return '<span class="' + className + '" style="font-size:' + pixelSize + 'px">' + value + '</span>';
    }

    function getBigValueHtml() {
      let body = '<div class="singlestat-panel-value-container">';

      if (panel.prefix) {
        body += getSpan('singlestat-panel-prefix', panel.prefixFontSize, panel.colorPrefix, panel.prefix);
      }

      body += getSpan('singlestat-panel-value', panel.valueFontSize, panel.colorValue, data.valueFormatted);

      if (panel.postfix) {
        body += getSpan('singlestat-panel-postfix', panel.postfixFontSize, panel.colorPostfix, panel.postfix);
      }

      body += '</div>';

      return body;
    }

    function getValueText() {
      let result = panel.prefix ? templateSrv.replace(panel.prefix, data.scopedVars) : '';
      result += data.valueFormatted;
      result += panel.postfix ? templateSrv.replace(panel.postfix, data.scopedVars) : '';

      return result;
    }

    function addGauge() {
      const width = elem.width();
      const height = elem.height();
      // Allow to use a bit more space for wide gauges
      const dimension = Math.min(width, height * 1.3);

      ctrl.invalidGaugeRange = false;
      if (panel.gauge.minValue > panel.gauge.maxValue) {
        ctrl.invalidGaugeRange = true;
        return;
      }

      const plotCanvas = $('<div></div>');
      const plotCss = {
        top: '5px',
        margin: 'auto',
        position: 'relative',
        height: height * 0.9 + 'px',
        width: dimension + 'px',
      };

      plotCanvas.css(plotCss);

      const thresholds = [];

      for (let i = 0; i < data.thresholds.length; i++) {
        thresholds.push({
          value: data.thresholds[i],
          color: data.colorMap[i],
        });
      }
      thresholds.push({
        value: panel.gauge.maxValue,
        color: data.colorMap[data.colorMap.length - 1],
      });

      const bgColor = config.bootData.user.lightTheme ? 'rgb(230,230,230)' : 'rgb(38,38,38)';

      const fontScale = parseInt(panel.valueFontSize, 10) / 100;
      const fontSize = Math.min(dimension / 5, 100) * fontScale;
      // Reduce gauge width if threshold labels enabled
      const gaugeWidthReduceRatio = panel.gauge.thresholdLabels ? 1.5 : 1;
      const gaugeWidth = Math.min(dimension / 6, 60) / gaugeWidthReduceRatio;
      const thresholdMarkersWidth = gaugeWidth / 5;
      const thresholdLabelFontSize = fontSize / 2.5;

      const options: any = {
        series: {
          gauges: {
            gauge: {
              min: panel.gauge.minValue,
              max: panel.gauge.maxValue,
              background: { color: bgColor },
              border: { color: null },
              shadow: { show: false },
              width: gaugeWidth,
            },
            frame: { show: false },
            label: { show: false },
            layout: { margin: 0, thresholdWidth: 0 },
            cell: { border: { width: 0 } },
            threshold: {
              values: thresholds,
              label: {
                show: panel.gauge.thresholdLabels,
                margin: thresholdMarkersWidth + 1,
                font: { size: thresholdLabelFontSize },
              },
              show: panel.gauge.thresholdMarkers,
              width: thresholdMarkersWidth,
            },
            value: {
              color: panel.colorValue ? getColorForValue(data, data.valueRounded) : null,
              formatter: () => {
                return getValueText();
              },
              font: {
                size: fontSize,
                family: config.theme.typography.fontFamily.sansSerif,
              },
            },
            show: true,
          },
        },
      };

      elem.append(plotCanvas);

      const plotSeries = {
        data: [[0, data.value]],
      };

      $.plot(plotCanvas, [plotSeries], options);
    }

    function addSparkline() {
      const width = elem.width();
      if (width < 30) {
        // element has not gotten it's width yet
        // delay sparkline render
        setTimeout(addSparkline, 30);
        return;
      }

      const height = ctrl.height;
      const plotCanvas = $('<div></div>');
      const plotCss: any = {};
      plotCss.position = 'absolute';
      plotCss.bottom = '0px';

      if (panel.sparkline.full) {
        plotCss.left = '0px';
        plotCss.width = width + 'px';
        const dynamicHeightMargin = height <= 100 ? 5 : Math.round(height / 100) * 15 + 5;
        plotCss.height = height - dynamicHeightMargin + 'px';
      } else {
        plotCss.left = '0px';
        plotCss.width = width + 'px';
        plotCss.height = Math.floor(height * 0.25) + 'px';
      }

      plotCanvas.css(plotCss);

      const options = {
        legend: { show: false },
        series: {
          lines: {
            show: true,
            fill: 1,
            lineWidth: 1,
            fillColor: getColorFromHexRgbOrName(panel.sparkline.fillColor, config.theme.type),
            zero: false,
          },
        },
        yaxis: {
          show: false,
          min: panel.sparkline.ymin,
          max: panel.sparkline.ymax,
        },
        xaxis: {
          show: false,
          mode: 'time',
          min: ctrl.range.from.valueOf(),
          max: ctrl.range.to.valueOf(),
        },
        grid: { hoverable: false, show: false },
      };

      elem.append(plotCanvas);

      const plotSeries = {
        data: data.flotpairs,
        color: getColorFromHexRgbOrName(panel.sparkline.lineColor, config.theme.type),
      };

      $.plot(plotCanvas, [plotSeries], options);
    }

    function render() {
      if (!ctrl.data) {
        return;
      }
      data = ctrl.data;

      // get thresholds
      data.thresholds = panel.thresholds.split(',').map((strVale: string) => {
        return Number(strVale.trim());
      });

      // Map panel colors to hex or rgb/a values
      data.colorMap = panel.colors.map((color: string) =>
        getColorFromHexRgbOrName(
          color,
          config.bootData.user.lightTheme ? GrafanaThemeType.Light : GrafanaThemeType.Dark
        )
      );

      const body = panel.gauge.show ? '' : getBigValueHtml();

      if (panel.colorBackground) {
        const color = getColorForValue(data, data.value);
        console.log(color);
        if (color) {
          $panelContainer.css('background-color', color);
          if (scope.fullscreen) {
            elem.css('background-color', color);
          } else {
            elem.css('background-color', '');
          }
        } else {
          $panelContainer.css('background-color', '');
          elem.css('background-color', '');
        }
      } else {
        $panelContainer.css('background-color', '');
        elem.css('background-color', '');
      }

      elem.html(body);

      if (panel.sparkline.show) {
        addSparkline();
      }

      if (panel.gauge.show) {
        addGauge();
      }

      elem.toggleClass('pointer', panel.links.length > 0);

      if (panel.links.length > 0) {
        linkInfo = linkSrv.getDataLinkUIModel(panel.links[0], data.scopedVars);
      } else {
        linkInfo = null;
      }
    }

    function hookupDrilldownLinkTooltip() {
      // drilldown link tooltip
      const drilldownTooltip = $('<div id="tooltip" class="">hello</div>"');

      elem.mouseleave(() => {
        if (panel.links.length === 0) {
          return;
        }
        $timeout(() => {
          drilldownTooltip.detach();
        });
      });

      elem.click(evt => {
        if (!linkInfo) {
          return;
        }
        // ignore title clicks in title
        if ($(evt).parents('.panel-header').length > 0) {
          return;
        }

        if (linkInfo.target === '_blank') {
          window.open(linkInfo.href, '_blank');
          return;
        }

        if (linkInfo.href.indexOf('http') === 0) {
          window.location.href = linkInfo.href;
        } else {
          $timeout(() => {
            $location.url(linkInfo.href);
          });
        }

        drilldownTooltip.detach();
      });

      elem.mousemove(e => {
        if (!linkInfo) {
          return;
        }

        drilldownTooltip.text('click to go to: ' + linkInfo.title);
        drilldownTooltip.place_tt(e.pageX, e.pageY - 50);
      });
    }

    hookupDrilldownLinkTooltip();

    this.events.on('render', () => {
      render();
      ctrl.renderingCompleted();
    });
  }
}

function getColorForValue(data: any, value: number) {
  if (!_.isFinite(value)) {
    return null;
  }

  for (let i = data.thresholds.length; i > 0; i--) {
    if (value >= data.thresholds[i - 1]) {
      return data.colorMap[i];
    }
  }

  return _.first(data.colorMap);
}

export { SingleStatCtrl, SingleStatCtrl as PanelCtrl, getColorForValue };
