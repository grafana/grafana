import { auto } from 'angular';
import { defaultsDeep, includes, keys, map, reduce, min as _min, max as _max } from 'lodash';

import { LegacyResponseData, PanelEvents, DataFrame, rangeUtil } from '@grafana/data';
import appEvents from 'app/core/app_events';
import TimeSeries from 'app/core/time_series2';
import kbn from 'app/core/utils/kbn';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getProcessedDataFrames } from 'app/features/query/state/runRequest';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { MetricsPanelCtrl } from 'app/plugins/sdk';
import { ZoomOutEvent } from 'app/types/events';

import { DataProcessor } from '../graph/data_processor';

import { axesEditor } from './axes_editor';
import { heatmapDisplayEditor } from './display_editor';
import {
  convertToHeatMap,
  convertToCards,
  histogramToHeatmap,
  calculateBucketSize,
  sortSeriesByLabel,
} from './heatmap_data_converter';
import rendering from './rendering';

const X_BUCKET_NUMBER_DEFAULT = 30;
const Y_BUCKET_NUMBER_DEFAULT = 10;

const panelDefaults: any = {
  heatmap: {},
  cards: {
    cardPadding: null,
    cardRound: null,
  },
  color: {
    mode: 'spectrum',
    cardColor: '#b4ff00',
    colorScale: 'sqrt',
    exponent: 0.5,
    colorScheme: 'interpolateOranges',
  },
  legend: {
    show: false,
  },
  dataFormat: 'timeseries',
  yBucketBound: 'auto',
  reverseYBuckets: false,
  xAxis: {
    show: true,
  },
  yAxis: {
    show: true,
    format: 'short',
    decimals: null,
    logBase: 1,
    splitFactor: null,
    min: null,
    max: null,
  },
  xBucketSize: null,
  xBucketNumber: null,
  yBucketSize: null,
  yBucketNumber: null,
  tooltip: {
    show: true,
    showHistogram: false,
  },
  highlightCards: true,
  hideZeroBuckets: false,
};

const colorModes = ['opacity', 'spectrum'];
const opacityScales = ['linear', 'sqrt'];

// Schemes from d3-scale-chromatic
// https://github.com/d3/d3-scale-chromatic
const colorSchemes = [
  // Diverging
  { name: 'Spectral', value: 'interpolateSpectral', invert: 'always' },
  { name: 'RdYlGn', value: 'interpolateRdYlGn', invert: 'always' },

  // Sequential (Single Hue)
  { name: 'Blues', value: 'interpolateBlues', invert: 'dark' },
  { name: 'Greens', value: 'interpolateGreens', invert: 'dark' },
  { name: 'Greys', value: 'interpolateGreys', invert: 'dark' },
  { name: 'Oranges', value: 'interpolateOranges', invert: 'dark' },
  { name: 'Purples', value: 'interpolatePurples', invert: 'dark' },
  { name: 'Reds', value: 'interpolateReds', invert: 'dark' },

  // Sequential (Multi-Hue)
  { name: 'Turbo', value: 'interpolateTurbo', invert: 'light' },
  { name: 'Cividis', value: 'interpolateCividis', invert: 'light' },
  { name: 'Viridis', value: 'interpolateViridis', invert: 'light' },
  { name: 'Magma', value: 'interpolateMagma', invert: 'light' },
  { name: 'Inferno', value: 'interpolateInferno', invert: 'light' },
  { name: 'Plasma', value: 'interpolatePlasma', invert: 'light' },
  { name: 'Warm', value: 'interpolateWarm', invert: 'light' },
  { name: 'Cool', value: 'interpolateCool', invert: 'light' },
  { name: 'Cubehelix', value: 'interpolateCubehelixDefault', invert: 'light' },
  { name: 'BuGn', value: 'interpolateBuGn', invert: 'dark' },
  { name: 'BuPu', value: 'interpolateBuPu', invert: 'dark' },
  { name: 'GnBu', value: 'interpolateGnBu', invert: 'dark' },
  { name: 'OrRd', value: 'interpolateOrRd', invert: 'dark' },
  { name: 'PuBuGn', value: 'interpolatePuBuGn', invert: 'dark' },
  { name: 'PuBu', value: 'interpolatePuBu', invert: 'dark' },
  { name: 'PuRd', value: 'interpolatePuRd', invert: 'dark' },
  { name: 'RdPu', value: 'interpolateRdPu', invert: 'dark' },
  { name: 'YlGnBu', value: 'interpolateYlGnBu', invert: 'dark' },
  { name: 'YlGn', value: 'interpolateYlGn', invert: 'dark' },
  { name: 'YlOrBr', value: 'interpolateYlOrBr', invert: 'dark' },
  { name: 'YlOrRd', value: 'interpolateYlOrRd', invert: 'dark' },
];

const dsSupportHistogramSort = ['elasticsearch'];

export class HeatmapCtrl extends MetricsPanelCtrl {
  static templateUrl = 'module.html';

  opacityScales: any = [];
  colorModes: any = [];
  colorSchemes: any = [];
  selectionActivated: boolean;
  unitFormats: any;
  data: any;
  series: TimeSeries[] = [];
  dataWarning: any;
  decimals = 0;
  scaledDecimals = 0;

  processor: DataProcessor; // Shared with graph panel

  /** @ngInject */
  constructor($scope: any, $injector: auto.IInjectorService, templateSrv: TemplateSrv, timeSrv: TimeSrv) {
    super($scope, $injector);

    this.selectionActivated = false;

    defaultsDeep(this.panel, panelDefaults);
    this.opacityScales = opacityScales;
    this.colorModes = colorModes;
    this.colorSchemes = colorSchemes;

    // Use DataFrames
    this.useDataFrames = true;
    this.processor = new DataProcessor({
      xaxis: { mode: 'custom' }, // NOT: 'histogram' :)
      aliasColors: {}, // avoids null reference
    });

    // Bind grafana panel events
    this.events.on(PanelEvents.render, this.onRender.bind(this));
    this.events.on(PanelEvents.dataFramesReceived, this.onDataFramesReceived.bind(this));
    this.events.on(PanelEvents.dataSnapshotLoad, this.onSnapshotLoad.bind(this));
    this.events.on(PanelEvents.editModeInitialized, this.onInitEditMode.bind(this));

    this.onCardColorChange = this.onCardColorChange.bind(this);

    // Make sure we do not save the version so migration to react version is kicked off
    delete this.panel.pluginVersion;
  }

  onInitEditMode() {
    this.addEditorTab('Axes', axesEditor, 2);
    this.addEditorTab('Display', heatmapDisplayEditor, 3);
    this.unitFormats = kbn.getUnitFormats();
  }

  zoomOut(evt: any) {
    appEvents.publish(new ZoomOutEvent({ scale: 2 }));
  }

  onRender() {
    if (this.panel.dataFormat === 'tsbuckets') {
      this.convertHistogramToHeatmapData();
    } else {
      this.convertTimeSeriesToHeatmapData();
    }
  }

  convertTimeSeriesToHeatmapData() {
    if (!this.range || !this.series) {
      return;
    }

    let xBucketSize, yBucketSize, bucketsData, heatmapStats;
    const logBase = this.panel.yAxis.logBase;

    const xBucketNumber = this.panel.xBucketNumber || X_BUCKET_NUMBER_DEFAULT;
    const xBucketSizeByNumber = Math.floor((this.range.to.valueOf() - this.range.from.valueOf()) / xBucketNumber);

    // Parse X bucket size (number or interval)
    const isIntervalString = kbn.intervalRegex.test(this.panel.xBucketSize);
    if (isIntervalString) {
      xBucketSize = rangeUtil.intervalToMs(this.panel.xBucketSize);
    } else if (
      isNaN(Number(this.panel.xBucketSize)) ||
      this.panel.xBucketSize === '' ||
      this.panel.xBucketSize === null
    ) {
      xBucketSize = xBucketSizeByNumber;
    } else {
      xBucketSize = Number(this.panel.xBucketSize);
    }

    // Calculate Y bucket size
    heatmapStats = this.parseSeries(this.series);
    const yBucketNumber = this.panel.yBucketNumber || Y_BUCKET_NUMBER_DEFAULT;
    if (logBase !== 1) {
      yBucketSize = this.panel.yAxis.splitFactor;
    } else {
      if (heatmapStats.max === heatmapStats.min) {
        if (heatmapStats.max) {
          yBucketSize = heatmapStats.max / Y_BUCKET_NUMBER_DEFAULT;
        } else {
          yBucketSize = 1;
        }
      } else {
        yBucketSize = (heatmapStats.max - heatmapStats.min) / yBucketNumber;
      }
      yBucketSize = this.panel.yBucketSize || yBucketSize;
    }

    bucketsData = convertToHeatMap(this.series, yBucketSize, xBucketSize, logBase);

    // Set default Y range if no data
    if (!heatmapStats.min && !heatmapStats.max) {
      heatmapStats = { min: -1, max: 1, minLog: 1 };
      yBucketSize = 1;
    }

    const { cards, cardStats } = convertToCards(bucketsData, this.panel.hideZeroBuckets);

    this.data = {
      buckets: bucketsData,
      heatmapStats: heatmapStats,
      xBucketSize: xBucketSize,
      yBucketSize: yBucketSize,
      cards: cards,
      cardStats: cardStats,
    };
  }

  convertHistogramToHeatmapData() {
    if (!this.range || !this.series) {
      return;
    }

    const panelDatasource = this.getPanelDataSourceType();
    let xBucketSize, yBucketSize, bucketsData, tsBuckets;

    // Try to sort series by bucket bound, if datasource doesn't do it.
    if (!includes(dsSupportHistogramSort, panelDatasource)) {
      this.series.sort(sortSeriesByLabel);
    }

    if (this.panel.reverseYBuckets) {
      this.series.reverse();
    }

    // Convert histogram to heatmap. Each histogram bucket represented by the series which name is
    // a top (or bottom, depends of datasource) bucket bound. Further, these values will be used as Y axis labels.
    bucketsData = histogramToHeatmap(this.series);

    tsBuckets = map(this.series, 'label');
    const yBucketBound = this.panel.yBucketBound;
    if (
      (panelDatasource === 'prometheus' && yBucketBound !== 'lower' && yBucketBound !== 'middle') ||
      yBucketBound === 'upper'
    ) {
      // Prometheus labels are upper inclusive bounds, so add empty bottom bucket label.
      tsBuckets = [''].concat(tsBuckets);
    } else {
      // Elasticsearch uses labels as lower bucket bounds, so add empty top bucket label.
      // Use this as a default mode as well.
      tsBuckets.push('');
    }

    // Calculate bucket size based on heatmap data
    const xBucketBoundSet = map(keys(bucketsData), (key) => Number(key));
    xBucketSize = calculateBucketSize(xBucketBoundSet);
    // Always let yBucketSize=1 in 'tsbuckets' mode
    yBucketSize = 1;

    const { cards, cardStats } = convertToCards(bucketsData, this.panel.hideZeroBuckets);

    this.data = {
      buckets: bucketsData,
      xBucketSize: xBucketSize,
      yBucketSize: yBucketSize,
      tsBuckets: tsBuckets,
      cards: cards,
      cardStats: cardStats,
    };
  }

  getPanelDataSourceType() {
    if (this.datasource && this.datasource.meta && this.datasource.meta.id) {
      return this.datasource.meta.id;
    } else {
      return 'unknown';
    }
  }

  // This should only be called from the snapshot callback
  onSnapshotLoad(dataList: LegacyResponseData[]) {
    this.onDataFramesReceived(getProcessedDataFrames(dataList));
  }

  // Directly support DataFrame
  onDataFramesReceived(data: DataFrame[]) {
    this.series = this.processor.getSeriesList({ dataList: data, range: this.range }).map((ts) => {
      ts.color = undefined; // remove whatever the processor set
      ts.flotpairs = ts.getFlotPairs(this.panel.nullPointMode);
      return ts;
    });

    this.dataWarning = null;
    const datapointsCount = reduce(
      this.series,
      (sum, series) => {
        return sum + series.datapoints.length;
      },
      0
    );

    if (datapointsCount === 0) {
      this.dataWarning = {
        title: 'No data points',
        tip: 'No datapoints returned from data query',
      };
    } else {
      for (const series of this.series) {
        if (series.isOutsideRange) {
          this.dataWarning = {
            title: 'Data points outside time range',
            tip: 'Can be caused by timezone mismatch or missing time filter in query',
          };
          break;
        }
      }
    }

    this.render();
  }

  onDataError() {
    this.series = [];
    this.render();
  }

  onCardColorChange(newColor: any) {
    this.panel.color.cardColor = newColor;
    this.render();
  }

  parseSeries(series: TimeSeries[]) {
    const min = _min(map(series, (s) => s.stats.min));
    const minLog = _min(map(series, (s) => s.stats.logmin));
    const max = _max(map(series, (s) => s.stats.max));

    return {
      max,
      min,
      minLog,
    };
  }

  parseHistogramSeries(series: TimeSeries[]) {
    const bounds = map(series, (s) => Number(s.alias));
    const min = _min(bounds);
    const minLog = _min(bounds);
    const max = _max(bounds);

    return {
      max: max,
      min: min,
      minLog: minLog,
    };
  }

  link(scope: any, elem: any, attrs: any, ctrl: any) {
    rendering(scope, elem, attrs, ctrl);
  }
}
