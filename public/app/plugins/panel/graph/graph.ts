import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.selection';
import 'vendor/flot/jquery.flot.time';
import 'vendor/flot/jquery.flot.stack';
import 'vendor/flot/jquery.flot.stackpercent';
import 'vendor/flot/jquery.flot.fillbelow';
import 'vendor/flot/jquery.flot.crosshair';
import 'vendor/flot/jquery.flot.dashes';
import './jquery.flot.events';

import $ from 'jquery';
import _ from 'lodash';
import { tickStep } from 'app/core/utils/ticks';
import { coreModule, updateLegendValues } from 'app/core/core';
import GraphTooltip from './graph_tooltip';
import { ThresholdManager } from './threshold_manager';
import { TimeRegionManager } from './time_region_manager';
import { EventManager } from 'app/features/annotations/all';
import { convertToHistogramData } from './histogram';
import { alignYLevel } from './align_yaxes';
import config from 'app/core/config';
import React from 'react';
import ReactDOM from 'react-dom';
import { GraphLegendProps, Legend } from './Legend/Legend';

import { GraphCtrl } from './module';
import { ContextMenuGroup, ContextMenuItem, graphTimeFormat, graphTickFormatter } from '@grafana/ui';
import { getCurrentTheme, provideTheme } from 'app/core/utils/ConfigProvider';
import {
  DataFrame,
  DataFrameView,
  FieldDisplay,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFlotPairsConstant,
  getTimeField,
  getValueFormat,
  hasLinks,
  LegacyGraphHoverClearEvent,
  LegacyGraphHoverEvent,
  LinkModelSupplier,
  PanelEvents,
  toUtc,
} from '@grafana/data';
import { GraphContextMenuCtrl } from './GraphContextMenuCtrl';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { ContextSrv } from 'app/core/services/context_srv';
import { getFieldLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';

const LegendWithThemeProvider = provideTheme(Legend);

class GraphElement {
  ctrl: GraphCtrl;
  contextMenu: GraphContextMenuCtrl;
  tooltip: any;
  dashboard: any;
  annotations: object[];
  panel: any;
  plot: any;
  sortedSeries?: any[];
  data: any[];
  panelWidth: number;
  eventManager: EventManager;
  thresholdManager: ThresholdManager;
  timeRegionManager: TimeRegionManager;
  legendElem: HTMLElement;

  constructor(private scope: any, private elem: JQuery, private timeSrv: TimeSrv) {
    this.ctrl = scope.ctrl;
    this.contextMenu = scope.ctrl.contextMenuCtrl;
    this.dashboard = this.ctrl.dashboard;
    this.panel = this.ctrl.panel;
    this.annotations = [];

    this.panelWidth = 0;
    this.eventManager = new EventManager(this.ctrl);
    this.thresholdManager = new ThresholdManager(this.ctrl);
    this.timeRegionManager = new TimeRegionManager(this.ctrl);
    // @ts-ignore
    this.tooltip = new GraphTooltip(this.elem, this.ctrl.dashboard, this.scope, () => {
      return this.sortedSeries;
    });

    // panel events
    this.ctrl.events.on(PanelEvents.panelTeardown, this.onPanelTeardown.bind(this));
    this.ctrl.events.on(PanelEvents.render, this.onRender.bind(this));

    // global events
    // Using old way here to use the scope unsubscribe model as the new $on function does not take scope
    this.ctrl.dashboard.events.on(LegacyGraphHoverEvent.type, this.onGraphHover.bind(this), this.scope);
    this.ctrl.dashboard.events.on(LegacyGraphHoverClearEvent.type, this.onGraphHoverClear.bind(this), this.scope);

    // plot events
    this.elem.bind('plotselected', this.onPlotSelected.bind(this));
    this.elem.bind('plotclick', this.onPlotClick.bind(this));

    // get graph legend element
    if (this.elem && this.elem.parent) {
      this.legendElem = this.elem.parent().find('.graph-legend')[0];
    }
  }

  onRender(renderData: any[]) {
    this.data = renderData || this.data;
    if (!this.data) {
      return;
    }

    this.annotations = this.ctrl.annotations || [];
    this.buildFlotPairs(this.data);
    const graphHeight = this.ctrl.height;
    updateLegendValues(this.data, this.panel, graphHeight);

    if (!this.panel.legend.show) {
      if (this.legendElem.hasChildNodes()) {
        ReactDOM.unmountComponentAtNode(this.legendElem);
      }
      this.renderPanel();
      return;
    }

    const { values, min, max, avg, current, total } = this.panel.legend;
    const { alignAsTable, rightSide, sideWidth, sort, sortDesc, hideEmpty, hideZero } = this.panel.legend;
    const legendOptions = { alignAsTable, rightSide, sideWidth, sort, sortDesc, hideEmpty, hideZero };
    const valueOptions = { values, min, max, avg, current, total };
    const legendProps: GraphLegendProps = {
      seriesList: this.data,
      hiddenSeries: this.ctrl.hiddenSeries,
      ...legendOptions,
      ...valueOptions,
      onToggleSeries: this.ctrl.onToggleSeries,
      onToggleSort: this.ctrl.onToggleSort,
      onColorChange: this.ctrl.onColorChange,
      onToggleAxis: this.ctrl.onToggleAxis,
    };

    const legendReactElem = React.createElement(LegendWithThemeProvider, legendProps);
    ReactDOM.render(legendReactElem, this.legendElem, () => this.renderPanel());
  }

  onGraphHover(evt: any) {
    // ignore other graph hover events if shared tooltip is disabled
    if (!this.dashboard.sharedTooltipModeEnabled()) {
      return;
    }

    // ignore if we are the emitter
    if (!this.plot || evt.panel.id === this.panel.id || this.ctrl.otherPanelInFullscreenMode()) {
      return;
    }

    this.tooltip.show(evt.pos);
  }

  onPanelTeardown() {
    if (this.plot) {
      this.plot.destroy();
      this.plot = null;
    }

    this.tooltip.destroy();
    this.elem.off();
    this.elem.remove();

    ReactDOM.unmountComponentAtNode(this.legendElem);
  }

  onGraphHoverClear(event: any, info: any) {
    if (this.plot) {
      this.tooltip.clear(this.plot);
    }
  }

  onPlotSelected(event: JQueryEventObject, ranges: any) {
    if (this.panel.xaxis.mode !== 'time') {
      // Skip if panel in histogram or series mode
      this.plot.clearSelection();
      return;
    }

    if ((ranges.ctrlKey || ranges.metaKey) && (this.dashboard.meta.canEdit || this.dashboard.meta.canMakeEditable)) {
      // Add annotation
      setTimeout(() => {
        this.eventManager.updateTime(ranges.xaxis);
      }, 100);
    } else {
      this.scope.$apply(() => {
        this.timeSrv.setTime({
          from: toUtc(ranges.xaxis.from),
          to: toUtc(ranges.xaxis.to),
        });
      });
    }
  }

  getContextMenuItemsSupplier = (
    flotPosition: { x: number; y: number },
    linksSupplier?: LinkModelSupplier<FieldDisplay>
  ): (() => ContextMenuGroup[]) => {
    return () => {
      // Fixed context menu items
      const items: ContextMenuGroup[] = [
        {
          items: [
            {
              label: 'Add annotation',
              icon: 'comment-alt',
              onClick: () => this.eventManager.updateTime({ from: flotPosition.x, to: null }),
            },
          ],
        },
      ];

      if (!linksSupplier) {
        return items;
      }

      const dataLinks = [
        {
          items: linksSupplier.getLinks(this.panel.scopedVars).map<ContextMenuItem>(link => {
            return {
              label: link.title,
              url: link.href,
              target: link.target,
              icon: `${link.target === '_self' ? 'link' : 'external-link-alt'}`,
              onClick: link.onClick,
            };
          }),
        },
      ];

      return [...items, ...dataLinks];
    };
  };

  onPlotClick(event: JQueryEventObject, pos: any, item: any) {
    const scrollContextElement = this.elem.closest('.view') ? this.elem.closest('.view').get()[0] : null;
    const contextMenuSourceItem = item;

    if (this.panel.xaxis.mode !== 'time') {
      // Skip if panel in histogram or series mode
      return;
    }

    if (pos.ctrlKey || pos.metaKey) {
      // Skip if range selected (added in "plotselected" event handler)
      if (pos.x !== pos.x1) {
        return;
      }

      // skip if dashboard is not saved yet (exists in db) or user cannot edit
      if (!this.dashboard.id || (!this.dashboard.meta.canEdit && !this.dashboard.meta.canMakeEditable)) {
        return;
      }

      setTimeout(() => {
        this.eventManager.updateTime({ from: pos.x, to: null });
      }, 100);
      return;
    } else {
      this.tooltip.clear(this.plot);
      let linksSupplier: LinkModelSupplier<FieldDisplay> | undefined;

      if (item) {
        // pickup y-axis index to know which field's config to apply
        const yAxisConfig = this.panel.yaxes[item.series.yaxis.n === 2 ? 1 : 0];
        const dataFrame = this.ctrl.dataList[item.series.dataFrameIndex];
        const field = dataFrame.fields[item.series.fieldIndex];
        const dataIndex = this.getDataIndexWithNullValuesCorrection(item, dataFrame);

        let links: any[] = this.panel.options.dataLinks || [];
        const hasLinksValue = hasLinks(field);
        if (hasLinksValue) {
          // Append the configured links to the panel datalinks
          links = [...links, ...field.config.links!];
        }
        const fieldConfig = {
          decimals: yAxisConfig.decimals,
          links,
        };
        const fieldDisplay = getDisplayProcessor({
          field: { config: fieldConfig, type: FieldType.number },
          theme: getCurrentTheme(),
          timeZone: this.dashboard.getTimezone(),
        })(field.values.get(dataIndex));
        linksSupplier = links.length
          ? getFieldLinksSupplier({
              display: fieldDisplay,
              name: field.name,
              view: new DataFrameView(dataFrame),
              rowIndex: dataIndex,
              colIndex: item.series.fieldIndex,
              field: fieldConfig,
              hasLinks: hasLinksValue,
            })
          : undefined;
      }

      this.scope.$apply(() => {
        // Setting nearest CustomScrollbar element as a scroll context for graph context menu
        this.contextMenu.setScrollContextElement(scrollContextElement);
        this.contextMenu.setSource(contextMenuSourceItem);
        this.contextMenu.setMenuItemsSupplier(this.getContextMenuItemsSupplier(pos, linksSupplier) as any);
        this.contextMenu.toggleMenu(pos);
      });
    }
  }

  getDataIndexWithNullValuesCorrection(item: any, dataFrame: DataFrame): number {
    /** This is one added to handle the scenario where we have null values in
     *  the time series data and the: "visualization options -> null value"
     *  set to "connected". In this scenario we will get the wrong dataIndex.
     *
     *  https://github.com/grafana/grafana/issues/22651
     */
    const { datapoint, dataIndex } = item;

    if (!Array.isArray(datapoint) || datapoint.length === 0) {
      return dataIndex;
    }

    const ts = datapoint[0];
    const { timeField } = getTimeField(dataFrame);

    if (!timeField || !timeField.values) {
      return dataIndex;
    }

    const field = timeField.values.get(dataIndex);

    if (field === ts) {
      return dataIndex;
    }

    const correctIndex = timeField.values.toArray().findIndex(value => value === ts);
    return correctIndex > -1 ? correctIndex : dataIndex;
  }

  shouldAbortRender() {
    if (!this.data) {
      return true;
    }

    if (this.panelWidth === 0) {
      return true;
    }

    return false;
  }

  drawHook(plot: any) {
    // add left axis labels
    if (this.panel.yaxes[0].label && this.panel.yaxes[0].show) {
      $("<div class='axisLabel left-yaxis-label flot-temp-elem'></div>")
        .text(this.panel.yaxes[0].label)
        .appendTo(this.elem);
    }

    // add right axis labels
    if (this.panel.yaxes[1].label && this.panel.yaxes[1].show) {
      $("<div class='axisLabel right-yaxis-label flot-temp-elem'></div>")
        .text(this.panel.yaxes[1].label)
        .appendTo(this.elem);
    }

    const { dataWarning } = this.ctrl;
    if (dataWarning) {
      const msg = $(`<div class="datapoints-warning flot-temp-elem">${dataWarning.title}</div>`);
      if (dataWarning.action) {
        $(`<button class="btn btn-secondary">${dataWarning.actionText}</button>`)
          .click(dataWarning.action)
          .appendTo(msg);
      }
      msg.appendTo(this.elem);
    }

    this.thresholdManager.draw(plot);
    this.timeRegionManager.draw(plot);
  }

  processOffsetHook(plot: any, gridMargin: { left: number; right: number }) {
    const left = this.panel.yaxes[0];
    const right = this.panel.yaxes[1];
    if (left.show && left.label) {
      gridMargin.left = 20;
    }
    if (right.show && right.label) {
      gridMargin.right = 20;
    }

    // apply y-axis min/max options
    const yaxis = plot.getYAxes();
    for (let i = 0; i < yaxis.length; i++) {
      const axis: any = yaxis[i];
      const panelOptions = this.panel.yaxes[i];
      axis.options.max = axis.options.max !== null ? axis.options.max : panelOptions.max;
      axis.options.min = axis.options.min !== null ? axis.options.min : panelOptions.min;
    }
  }

  processRangeHook(plot: any) {
    const yAxes = plot.getYAxes();
    const align = this.panel.yaxis.align || false;

    if (yAxes.length > 1 && align === true) {
      const level = this.panel.yaxis.alignLevel || 0;
      alignYLevel(yAxes, parseFloat(level));
    }
  }

  // Series could have different timeSteps,
  // let's find the smallest one so that bars are correctly rendered.
  // In addition, only take series which are rendered as bars for this.
  getMinTimeStepOfSeries(data: any[]) {
    let min = Number.MAX_VALUE;

    for (let i = 0; i < data.length; i++) {
      if (!data[i].stats.timeStep) {
        continue;
      }
      if (this.panel.bars) {
        if (data[i].bars && data[i].bars.show === false) {
          continue;
        }
      } else {
        if (typeof data[i].bars === 'undefined' || typeof data[i].bars.show === 'undefined' || !data[i].bars.show) {
          continue;
        }
      }

      if (data[i].stats.timeStep < min) {
        min = data[i].stats.timeStep;
      }
    }

    return min;
  }

  // Function for rendering panel
  renderPanel() {
    this.panelWidth = this.elem.width() ?? 0;

    if (this.shouldAbortRender()) {
      return;
    }

    // give space to alert editing
    this.thresholdManager.prepare(this.elem, this.data);

    // un-check dashes if lines are unchecked
    this.panel.dashes = this.panel.lines ? this.panel.dashes : false;

    // Populate element
    const options: any = this.buildFlotOptions(this.panel);
    this.prepareXAxis(options, this.panel);
    this.configureYAxisOptions(this.data, options);
    this.thresholdManager.addFlotOptions(options, this.panel);
    this.timeRegionManager.addFlotOptions(options, this.panel);
    this.eventManager.addFlotEvents(this.annotations, options);
    this.sortedSeries = this.sortSeries(this.data, this.panel);
    this.callPlot(options, true);
  }

  buildFlotPairs(data: any) {
    for (let i = 0; i < data.length; i++) {
      const series = data[i];
      series.data = series.getFlotPairs(series.nullPointMode || this.panel.nullPointMode);

      if (series.transform === 'constant') {
        series.data = getFlotPairsConstant(series.data, this.ctrl.range);
      }

      // if hidden remove points and disable stack
      if (this.ctrl.hiddenSeries[series.alias]) {
        series.data = [];
        series.stack = false;
      }
    }
  }

  prepareXAxis(options: any, panel: any) {
    switch (panel.xaxis.mode) {
      case 'series': {
        options.series.bars.barWidth = 0.7;
        options.series.bars.align = 'center';

        for (let i = 0; i < this.data.length; i++) {
          const series = this.data[i];
          series.data = [[i + 1, series.stats[panel.xaxis.values[0]]]];
        }

        this.addXSeriesAxis(options);
        break;
      }
      case 'histogram': {
        let bucketSize: number;

        if (this.data.length) {
          let histMin = _.min(_.map(this.data, s => s.stats.min));
          let histMax = _.max(_.map(this.data, s => s.stats.max));
          const ticks = panel.xaxis.buckets || this.panelWidth / 50;
          if (panel.xaxis.min != null) {
            const isInvalidXaxisMin = tickStep(panel.xaxis.min, histMax, ticks) <= 0;
            histMin = isInvalidXaxisMin ? histMin : panel.xaxis.min;
          }
          if (panel.xaxis.max != null) {
            const isInvalidXaxisMax = tickStep(histMin, panel.xaxis.max, ticks) <= 0;
            histMax = isInvalidXaxisMax ? histMax : panel.xaxis.max;
          }
          bucketSize = tickStep(histMin, histMax, ticks);
          options.series.bars.barWidth = bucketSize * 0.8;
          this.data = convertToHistogramData(this.data, bucketSize, this.ctrl.hiddenSeries, histMin, histMax);
        } else {
          bucketSize = 0;
        }

        this.addXHistogramAxis(options, bucketSize);
        break;
      }
      case 'table': {
        options.series.bars.barWidth = 0.7;
        options.series.bars.align = 'center';
        this.addXTableAxis(options);
        break;
      }
      default: {
        options.series.bars.barWidth = this.getMinTimeStepOfSeries(this.data) / 1.5;
        this.addTimeAxis(options);
        break;
      }
    }
  }

  callPlot(options: any, incrementRenderCounter: boolean) {
    try {
      this.plot = $.plot(this.elem, this.sortedSeries, options);
      if (this.ctrl.renderError) {
        delete this.ctrl.error;
      }
    } catch (e) {
      console.error('flotcharts error', e);
      this.ctrl.error = e.message || 'Render Error';
      this.ctrl.renderError = true;
    }

    if (incrementRenderCounter) {
      this.ctrl.renderingCompleted();
    }
  }

  buildFlotOptions(panel: any) {
    let gridColor = '#c8c8c8';
    if (config.bootData.user.lightTheme === true) {
      gridColor = '#a1a1a1';
    }
    const stack = panel.stack ? true : null;
    const options: any = {
      hooks: {
        draw: [this.drawHook.bind(this)],
        processOffset: [this.processOffsetHook.bind(this)],
        processRange: [this.processRangeHook.bind(this)],
      },
      legend: { show: false },
      series: {
        stackpercent: panel.stack ? panel.percentage : false,
        stack: panel.percentage ? null : stack,
        lines: {
          show: panel.lines,
          zero: false,
          fill: this.translateFillOption(panel.fill),
          fillColor: this.getFillGradient(panel.fillGradient),
          lineWidth: panel.dashes ? 0 : panel.linewidth,
          steps: panel.steppedLine,
        },
        dashes: {
          show: panel.dashes,
          lineWidth: panel.linewidth,
          dashLength: [panel.dashLength, panel.spaceLength],
        },
        bars: {
          show: panel.bars,
          fill: 1,
          barWidth: 1,
          zero: false,
          lineWidth: 0,
        },
        points: {
          show: panel.points,
          fill: 1,
          fillColor: false,
          radius: panel.points ? panel.pointradius : 2,
        },
        shadowSize: 0,
      },
      yaxes: [],
      xaxis: {},
      grid: {
        minBorderMargin: 0,
        markings: [],
        backgroundColor: null,
        borderWidth: 0,
        hoverable: true,
        clickable: true,
        color: gridColor,
        margin: { left: 0, right: 0 },
        labelMarginX: 0,
        mouseActiveRadius: 30,
      },
      selection: {
        mode: 'x',
        color: '#666',
      },
      crosshair: {
        mode: 'x',
      },
    };
    return options;
  }

  sortSeries(series: any, panel: any) {
    const sortBy = panel.legend.sort;
    const sortOrder = panel.legend.sortDesc;
    const haveSortBy = sortBy !== null && sortBy !== undefined && panel.legend[sortBy];
    const haveSortOrder = sortOrder !== null && sortOrder !== undefined;
    const shouldSortBy = panel.stack && haveSortBy && haveSortOrder && panel.legend.alignAsTable;
    const sortDesc = panel.legend.sortDesc === true ? -1 : 1;

    if (shouldSortBy) {
      return _.sortBy(series, s => s.stats[sortBy] * sortDesc);
    } else {
      return _.sortBy(series, s => s.zindex);
    }
  }

  getFillGradient(amount: number) {
    if (!amount) {
      return null;
    }

    return {
      colors: [{ opacity: 0.0 }, { opacity: amount / 10 }],
    };
  }

  translateFillOption(fill: number) {
    if (this.panel.percentage && this.panel.stack) {
      return fill === 0 ? 0.001 : fill / 10;
    } else {
      return fill / 10;
    }
  }

  addTimeAxis(options: any) {
    const ticks = this.panelWidth / 100;
    const min = _.isUndefined(this.ctrl.range.from) ? null : this.ctrl.range.from.valueOf();
    const max = _.isUndefined(this.ctrl.range.to) ? null : this.ctrl.range.to.valueOf();

    options.xaxis = {
      timezone: this.dashboard.getTimezone(),
      show: this.panel.xaxis.show,
      mode: 'time',
      min: min,
      max: max,
      label: 'Datetime',
      ticks: ticks,
      timeformat: graphTimeFormat(ticks, min, max),
      tickFormatter: graphTickFormatter,
    };
  }

  addXSeriesAxis(options: any) {
    const ticks = _.map(this.data, (series, index) => {
      return [index + 1, series.alias];
    });

    options.xaxis = {
      timezone: this.dashboard.getTimezone(),
      show: this.panel.xaxis.show,
      mode: null,
      min: 0,
      max: ticks.length + 1,
      label: 'Datetime',
      ticks: ticks,
    };
  }

  addXHistogramAxis(options: any, bucketSize: number) {
    let ticks: number | number[];
    let min: number | undefined;
    let max: number | undefined;

    const defaultTicks = this.panelWidth / 50;

    if (this.data.length && bucketSize) {
      const tickValues = [];

      for (const d of this.data) {
        for (const point of d.data) {
          tickValues[point[0]] = true;
        }
      }

      ticks = Object.keys(tickValues).map(v => Number(v));
      min = _.min(ticks)!;
      max = _.max(ticks)!;

      // Adjust tick step
      let tickStep = bucketSize;
      let ticksNum = Math.floor((max - min) / tickStep);
      while (ticksNum > defaultTicks) {
        tickStep = tickStep * 2;
        ticksNum = Math.ceil((max - min) / tickStep);
      }

      // Expand ticks for pretty view
      min = Math.floor(min / tickStep) * tickStep;
      // 1.01 is 101% - ensure we have enough space for last bar
      max = Math.ceil((max * 1.01) / tickStep) * tickStep;

      ticks = [];
      for (let i = min; i <= max; i += tickStep) {
        ticks.push(i);
      }
    } else {
      // Set defaults if no data
      ticks = defaultTicks / 2;
      min = 0;
      max = 1;
    }

    options.xaxis = {
      timezone: this.dashboard.getTimezone(),
      show: this.panel.xaxis.show,
      mode: null,
      min: min,
      max: max,
      label: 'Histogram',
      ticks: ticks,
    };

    // Use 'short' format for histogram values
    this.configureAxisMode(options.xaxis, 'short');
  }

  addXTableAxis(options: any) {
    let ticks = _.map(this.data, (series, seriesIndex) => {
      return _.map(series.datapoints, (point, pointIndex) => {
        const tickIndex = seriesIndex * series.datapoints.length + pointIndex;
        return [tickIndex + 1, point[1]];
      });
    });
    // @ts-ignore, potential bug? is this _.flattenDeep?
    ticks = _.flatten(ticks, true);

    options.xaxis = {
      timezone: this.dashboard.getTimezone(),
      show: this.panel.xaxis.show,
      mode: null,
      min: 0,
      max: ticks.length + 1,
      label: 'Datetime',
      ticks: ticks,
    };
  }

  configureYAxisOptions(data: any, options: any) {
    const defaults = {
      position: 'left',
      show: this.panel.yaxes[0].show,
      index: 1,
      logBase: this.panel.yaxes[0].logBase || 1,
      min: this.parseNumber(this.panel.yaxes[0].min),
      max: this.parseNumber(this.panel.yaxes[0].max),
      tickDecimals: this.panel.yaxes[0].decimals,
    };

    options.yaxes.push(defaults);

    if (_.find(data, { yaxis: 2 })) {
      const secondY = _.clone(defaults);
      secondY.index = 2;
      secondY.show = this.panel.yaxes[1].show;
      secondY.logBase = this.panel.yaxes[1].logBase || 1;
      secondY.position = 'right';
      secondY.min = this.parseNumber(this.panel.yaxes[1].min);
      secondY.max = this.parseNumber(this.panel.yaxes[1].max);
      secondY.tickDecimals = this.panel.yaxes[1].decimals;
      options.yaxes.push(secondY);

      this.applyLogScale(options.yaxes[1], data);
      this.configureAxisMode(
        options.yaxes[1],
        this.panel.percentage && this.panel.stack ? 'percent' : this.panel.yaxes[1].format
      );
    }
    this.applyLogScale(options.yaxes[0], data);
    this.configureAxisMode(
      options.yaxes[0],
      this.panel.percentage && this.panel.stack ? 'percent' : this.panel.yaxes[0].format
    );
  }

  parseNumber(value: any) {
    if (value === null || typeof value === 'undefined') {
      return null;
    }

    return _.toNumber(value);
  }

  applyLogScale(axis: any, data: any) {
    if (axis.logBase === 1) {
      return;
    }

    const minSetToZero = axis.min === 0;

    if (axis.min < Number.MIN_VALUE) {
      axis.min = null;
    }
    if (axis.max < Number.MIN_VALUE) {
      axis.max = null;
    }

    let series, i;
    let max = axis.max,
      min = axis.min;

    for (i = 0; i < data.length; i++) {
      series = data[i];
      if (series.yaxis === axis.index) {
        if (!max || max < series.stats.max) {
          max = series.stats.max;
        }
        if (!min || min > series.stats.logmin) {
          min = series.stats.logmin;
        }
      }
    }

    axis.transform = (v: number) => {
      return v < Number.MIN_VALUE ? null : Math.log(v) / Math.log(axis.logBase);
    };
    axis.inverseTransform = (v: any) => {
      return Math.pow(axis.logBase, v);
    };

    if (!max && !min) {
      max = axis.inverseTransform(+2);
      min = axis.inverseTransform(-2);
    } else if (!max) {
      max = min * axis.inverseTransform(+4);
    } else if (!min) {
      min = max * axis.inverseTransform(-4);
    }

    if (axis.min) {
      min = axis.inverseTransform(Math.ceil(axis.transform(axis.min)));
    } else {
      min = axis.min = axis.inverseTransform(Math.floor(axis.transform(min)));
    }
    if (axis.max) {
      max = axis.inverseTransform(Math.floor(axis.transform(axis.max)));
    } else {
      max = axis.max = axis.inverseTransform(Math.ceil(axis.transform(max)));
    }

    if (!min || min < Number.MIN_VALUE || !max || max < Number.MIN_VALUE) {
      return;
    }

    if (Number.isFinite(min) && Number.isFinite(max)) {
      if (minSetToZero) {
        axis.min = 0.1;
        min = 1;
      }

      axis.ticks = this.generateTicksForLogScaleYAxis(min, max, axis.logBase);
      if (minSetToZero) {
        axis.ticks.unshift(0.1);
      }
      if (axis.ticks[axis.ticks.length - 1] > axis.max) {
        axis.max = axis.ticks[axis.ticks.length - 1];
      }
    } else {
      axis.ticks = [1, 2];
      delete axis.min;
      delete axis.max;
    }
  }

  generateTicksForLogScaleYAxis(min: any, max: number, logBase: number) {
    let ticks = [];

    let nextTick;
    for (nextTick = min; nextTick <= max; nextTick *= logBase) {
      ticks.push(nextTick);
    }

    const maxNumTicks = Math.ceil(this.ctrl.height / 25);
    const numTicks = ticks.length;
    if (numTicks > maxNumTicks) {
      const factor = Math.ceil(numTicks / maxNumTicks) * logBase;
      ticks = [];

      for (nextTick = min; nextTick <= max * factor; nextTick *= factor) {
        ticks.push(nextTick);
      }
    }

    return ticks;
  }

  configureAxisMode(axis: { tickFormatter: (val: any, axis: any) => string }, format: string) {
    axis.tickFormatter = (val, axis) => {
      const formatter = getValueFormat(format);

      if (!formatter) {
        throw new Error(`Unit '${format}' is not supported`);
      }
      return formattedValueToString(formatter(val, axis.tickDecimals, axis.scaledDecimals));
    };
  }
}

/** @ngInject */
function graphDirective(timeSrv: TimeSrv, popoverSrv: any, contextSrv: ContextSrv) {
  return {
    restrict: 'A',
    template: '',
    link: (scope: any, elem: JQuery) => {
      return new GraphElement(scope, elem, timeSrv);
    },
  };
}

coreModule.directive('grafanaGraph', graphDirective);
export { GraphElement, graphDirective };
