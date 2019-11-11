import _ from 'lodash';
import { auto } from 'angular';
import $ from 'jquery';
import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.gauge';
import 'app/features/panel/panellinks/link_srv';

import {
  DataFrame,
  DisplayValue,
  Field,
  fieldReducers,
  FieldType,
  GraphSeriesValue,
  KeyValue,
  LinkModel,
  reduceField,
  ReducerID,
  LegacyResponseData,
  getFlotPairs,
  getDisplayProcessor,
  getColorFromHexRgbOrName,
  PanelEvents,
} from '@grafana/data';

import { convertOldAngularValueMapping } from '@grafana/ui';

import { CoreEvents } from 'app/types';
import kbn from 'app/core/utils/kbn';
import config from 'app/core/config';
import { MetricsPanelCtrl } from 'app/plugins/sdk';
import { LinkSrv } from 'app/features/panel/panellinks/link_srv';
import { getProcessedDataFrames } from 'app/features/dashboard/state/runRequest';

const BASE_FONT_SIZE = 38;

export interface ShowData {
  field: Field;
  value: any;
  sparkline: GraphSeriesValue[][];
  display: DisplayValue;

  scopedVars: any;

  thresholds: any[];
  colorMap: any;
}

class SingleStatCtrl extends MetricsPanelCtrl {
  static templateUrl = 'module.html';

  data: Partial<ShowData> = {};

  fontSizes: any[];
  unitFormats: any[];
  fieldNames: string[] = [];

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

    this.events.on(CoreEvents.dataFramesReceived, this.onFramesReceived.bind(this));
    this.events.on(PanelEvents.dataSnapshotLoad, this.onSnapshotLoad.bind(this));
    this.events.on(PanelEvents.editModeInitialized, this.onInitEditMode.bind(this));

    this.useDataFrames = true;

    this.onSparklineColorChange = this.onSparklineColorChange.bind(this);
    this.onSparklineFillChange = this.onSparklineFillChange.bind(this);
  }

  onInitEditMode() {
    this.fontSizes = ['20%', '30%', '50%', '70%', '80%', '100%', '110%', '120%', '150%', '170%', '200%'];
    this.addEditorTab('Options', 'public/app/plugins/panel/singlestat/editor.html', 2);
    this.addEditorTab('Value Mappings', 'public/app/plugins/panel/singlestat/mappings.html', 3);
    this.unitFormats = kbn.getUnitFormats();
  }

  migrateToGaugePanel(migrate: boolean) {
    if (migrate) {
      this.onPluginTypeChange(config.panels['gauge']);
    } else {
      this.panel.gauge.show = false;
      this.render();
    }
  }

  setUnitFormat(subItem: { value: any }) {
    this.panel.format = subItem.value;
    this.refresh();
  }

  onSnapshotLoad(dataList: LegacyResponseData[]) {
    this.onFramesReceived(getProcessedDataFrames(dataList));
  }

  onFramesReceived(frames: DataFrame[]) {
    const { panel } = this;

    if (frames && frames.length > 1) {
      this.data = {
        value: 0,
        display: {
          text: 'Only queries that return single series/table is supported',
          numeric: NaN,
        },
      };
      this.render();
      return;
    }

    const distinct = getDistinctNames(frames);
    let fieldInfo = distinct.byName[panel.tableColumn]; //
    this.fieldNames = distinct.names;

    if (!fieldInfo) {
      fieldInfo = distinct.first;
    }

    if (!fieldInfo) {
      const processor = getDisplayProcessor({
        config: {
          mappings: convertOldAngularValueMapping(this.panel),
          noValue: 'No Data',
        },
        theme: config.theme,
      });
      // When we don't have any field
      this.data = {
        value: null,
        display: processor(null),
      };
    } else {
      this.data = this.processField(fieldInfo);
    }

    this.render();
  }

  processField(fieldInfo: FieldInfo) {
    const { panel, dashboard } = this;

    const name = fieldInfo.field.config.title || fieldInfo.field.name;
    let calc = panel.valueName;
    let calcField = fieldInfo.field;
    let val: any = undefined;

    if ('name' === calc) {
      val = name;
    } else {
      if ('last_time' === calc) {
        if (fieldInfo.frame.firstTimeField) {
          calcField = fieldInfo.frame.firstTimeField;
          calc = ReducerID.last;
        }
      }

      // Normalize functions (avg -> mean, etc)
      const r = fieldReducers.getIfExists(calc);
      if (r) {
        calc = r.id;
        // With strings, don't accidentally use a math function
        if (calcField.type === FieldType.string) {
          const avoid = [ReducerID.mean, ReducerID.sum];
          if (avoid.includes(calc)) {
            calc = panel.valueName = ReducerID.first;
          }
        }
      } else {
        calc = ReducerID.lastNotNull;
      }

      // Calculate the value
      val = reduceField({
        field: calcField,
        reducers: [calc],
      })[calc];
    }

    const processor = getDisplayProcessor({
      config: {
        ...fieldInfo.field.config,
        unit: panel.format,
        decimals: panel.decimals,
        mappings: convertOldAngularValueMapping(panel),
      },
      theme: config.theme,
      isUtc: dashboard.isTimezoneUtc && dashboard.isTimezoneUtc(),
    });

    const sparkline: any[] = [];
    const data = {
      field: fieldInfo.field,
      value: val,
      display: processor(val),
      scopedVars: _.extend({}, panel.scopedVars),
      sparkline,
    };

    data.scopedVars['__name'] = { value: name };
    panel.tableColumn = this.fieldNames.length > 1 ? name : '';

    // Get the fields for a sparkline
    if (panel.sparkline && panel.sparkline.show && fieldInfo.frame.firstTimeField) {
      data.sparkline = getFlotPairs({
        xField: fieldInfo.frame.firstTimeField,
        yField: fieldInfo.field,
        nullValueMode: panel.nullPointMode,
      });
    }

    return data;
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
    let linkInfo: LinkModel<any> | null = null;
    const $panelContainer = elem.find('.panel-container');
    elem = elem.find('.singlestat-panel');

    function applyColoringThresholds(valueString: string) {
      const data = ctrl.data;
      const color = getColorForValue(data, data.value);
      if (color) {
        return '<span style="color:' + color + '">' + valueString + '</span>';
      }

      return valueString;
    }

    function getSpan(className: string, fontSizePercent: string, applyColoring: any, value: string) {
      value = $sanitize(templateSrv.replace(value, ctrl.data.scopedVars));
      value = applyColoring ? applyColoringThresholds(value) : value;
      const pixelSize = (parseInt(fontSizePercent, 10) / 100) * BASE_FONT_SIZE;
      return '<span class="' + className + '" style="font-size:' + pixelSize + 'px">' + value + '</span>';
    }

    function getBigValueHtml() {
      const data: ShowData = ctrl.data;
      let body = '<div class="singlestat-panel-value-container">';

      if (panel.prefix) {
        body += getSpan('singlestat-panel-prefix', panel.prefixFontSize, panel.colorPrefix, panel.prefix);
      }

      body += getSpan('singlestat-panel-value', panel.valueFontSize, panel.colorValue, data.display.text);

      if (panel.postfix) {
        body += getSpan('singlestat-panel-postfix', panel.postfixFontSize, panel.colorPostfix, panel.postfix);
      }

      body += '</div>';

      return body;
    }

    function getValueText() {
      const data: ShowData = ctrl.data;
      let result = panel.prefix ? templateSrv.replace(panel.prefix, data.scopedVars) : '';
      result += data.display.text;
      result += panel.postfix ? templateSrv.replace(panel.postfix, data.scopedVars) : '';

      return result;
    }

    function addGauge() {
      const data: ShowData = ctrl.data;
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
              color: panel.colorValue ? getColorForValue(data, data.display.numeric) : null,
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
      const data: ShowData = ctrl.data;
      const width = elem.width();
      if (width < 30) {
        // element has not gotten it's width yet
        // delay sparkline render
        setTimeout(addSparkline, 30);
        return;
      }
      if (!data.sparkline || !data.sparkline.length) {
        // no sparkline data
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
        data: data.sparkline,
        color: getColorFromHexRgbOrName(panel.sparkline.lineColor, config.theme.type),
      };

      $.plot(plotCanvas, [plotSeries], options);
    }

    function render() {
      if (!ctrl.data) {
        return;
      }
      const { data, panel } = ctrl;

      // get thresholds
      data.thresholds = panel.thresholds
        ? panel.thresholds.split(',').map((strVale: string) => {
            return Number(strVale.trim());
          })
        : [];

      // Map panel colors to hex or rgb/a values
      if (panel.colors) {
        data.colorMap = panel.colors.map((color: string) => getColorFromHexRgbOrName(color, config.theme.type));
      }

      const body = panel.gauge.show ? '' : getBigValueHtml();

      if (panel.colorBackground) {
        const color = getColorForValue(data, data.display.numeric);
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
        linkInfo = linkSrv.getDataLinkUIModel(panel.links[0], data.scopedVars, {});
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

    this.events.on(PanelEvents.render, () => {
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

//------------------------------------------------
// Private utility functions
// Somethign like this should be avaliable in a
//  DataFrame[] abstraction helper
//------------------------------------------------

interface FrameInfo {
  firstTimeField?: Field;
  frame: DataFrame;
}

interface FieldInfo {
  field: Field;
  frame: FrameInfo;
}

interface DistinctFieldsInfo {
  first?: FieldInfo;
  byName: KeyValue<FieldInfo>;
  names: string[];
}

function getDistinctNames(data: DataFrame[]): DistinctFieldsInfo {
  const distinct: DistinctFieldsInfo = {
    byName: {},
    names: [],
  };
  for (const frame of data) {
    const info: FrameInfo = { frame };
    for (const field of frame.fields) {
      if (field.type === FieldType.time) {
        if (!info.firstTimeField) {
          info.firstTimeField = field;
        }
      } else {
        const f = { field, frame: info };
        if (!distinct.first) {
          distinct.first = f;
        }
        let t = field.config.title;
        if (t && !distinct.byName[t]) {
          distinct.byName[t] = f;
          distinct.names.push(t);
        }
        t = field.name;
        if (t && !distinct.byName[t]) {
          distinct.byName[t] = f;
          distinct.names.push(t);
        }
      }
    }
  }
  return distinct;
}

export { SingleStatCtrl, SingleStatCtrl as PanelCtrl, getColorForValue };
