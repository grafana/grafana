import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import * as Series from 'app/types/series';
import * as MultiStatPanel from './types';
import { PanelModel } from 'app/features/dashboard/panel_model';
import TimeSeries from 'app/core/time_series2';
import { getDecimalsForValue } from 'app/core/utils/ticks';
// import TableModel from 'app/core/table_model';

type MultistatPanelModel = PanelModel & MultiStatPanel.PanelOptions;

const REASONABLE_ROW_NUMBER = 20;

export function convertTSDataToMultistat(dataList: Series.SeriesData[], panel) {
  const series = dataList.map(s => handleSeries(s, panel));
  return convertTimeSeriesToMultistatData(series, panel);
}

export function convertTableDataToMultistat(dataList: Series.SeriesData[], panel) {
  const tables = dataList.map(s => handleTable(s, panel));
  return convertTableToMultistatData(tables, panel);
}

export function handleSeries(seriesData: Series.SeriesData, panel): TimeSeries {
  var series = new TimeSeries({
    datapoints: seriesData.datapoints || [],
    alias: seriesData.target,
  });

  series.flotpairs = series.getFlotPairs(panel.nullPointMode);
  return series;
}

export function convertTimeSeriesToMultistatData(
  series: TimeSeries[],
  panel: MultistatPanelModel
): Series.SeriesStat[] {
  let panelData: Series.SeriesStat[] = [];

  for (let ts of series) {
    let seriesStat = convertToSeriesStat(ts, panel);
    // this.setValueMapping(seriesStat);
    panelData.push(seriesStat);
  }

  return panelData;
}

export function convertToSeriesStat(ts: TimeSeries, panel: MultistatPanelModel): Series.SeriesStat {
  let seriesStat: Series.SeriesStat = {
    flotpairs: [],
    label: ts.label,
    alias: ts.alias,
  };

  let lastPoint = _.last(ts.datapoints);
  let lastValue = _.isArray(lastPoint) ? lastPoint[0] : null;

  if (panel.valueName === 'name') {
    seriesStat.value = 0;
    seriesStat.valueRounded = 0;
    seriesStat.valueFormatted = ts.alias;
  } else if (_.isString(lastValue)) {
    seriesStat.value = 0;
    seriesStat.valueFormatted = _.escape(lastValue);
    seriesStat.valueRounded = 0;
  } else if (panel.valueName === 'last_time') {
    let formatFunc = kbn.valueFormats[panel.format];
    seriesStat.value = lastPoint[1];
    seriesStat.valueRounded = seriesStat.value;
    seriesStat.valueFormatted = formatFunc(seriesStat.value, this.dashboard.isTimezoneUtc());
  } else {
    seriesStat.value = ts.stats[panel.valueName];
    seriesStat.flotpairs = ts.flotpairs;

    let decimalInfo = getDecimalsForValue(seriesStat.value);
    let formatFunc = kbn.valueFormats[panel.format];
    seriesStat.valueFormatted = formatFunc(seriesStat.value, decimalInfo.decimals, decimalInfo.scaledDecimals);
    seriesStat.valueRounded = kbn.roundValue(seriesStat.value, decimalInfo.decimals);
  }

  // Add $__name variable for using in prefix or postfix
  seriesStat.scopedVars = _.extend({}, panel.scopedVars);
  seriesStat.scopedVars['__name'] = { value: ts.label };

  return seriesStat;
}

export function handleTable(tableData, panel) {
  const datapoints = [];
  const columnNames = {};

  tableData.columns.forEach((column, columnIndex) => {
    columnNames[columnIndex] = column.text;
  });

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

export function convertTableToMultistatData(tables, panel: MultistatPanelModel) {
  let panelData: Series.SeriesStat[] = [];

  if (!tables || tables.length === 0) {
    return [];
  }

  for (const table of tables) {
    let tableStats = convertToTableStat(table, panel);
    tableStats = _.sortBy(tableStats, s => s.label);
    // this.setValueMapping(tableStats);
    panelData.push(...tableStats);
  }

  return panelData;
}

export function convertToTableStat(table, panel) {
  let tableStats: any = [];

  if (table.length === 0 || table[0][panel.tableColumnValue] === undefined) {
    return;
  }

  if (table.length > REASONABLE_ROW_NUMBER) {
    throw new Error(`Too many rows in the table (expected ${REASONABLE_ROW_NUMBER} or less, got ${table.length})
      returned by the query. Try to limit it and try again.
    `);
  }

  for (const row of table) {
    let tableStat: any = {};
    tableStat.value = row[panel.tableColumnValue];
    tableStat.label = tableStat.alias = row[panel.tableColumnLabel];

    if (_.isString(tableStat.value)) {
      tableStat.valueFormatted = _.escape(tableStat.value);
      tableStat.value = 0;
      tableStat.valueRounded = 0;
    } else {
      const decimalInfo = getDecimalsForValue(tableStat.value);
      const formatFunc = kbn.valueFormats[panel.format];
      tableStat.valueFormatted = formatFunc(
        row[panel.tableColumnValue],
        decimalInfo.decimals,
        decimalInfo.scaledDecimals
      );
      tableStat.valueRounded = kbn.roundValue(tableStat.value, panel.decimals || 0);
    }
    tableStats.push(tableStat);
  }

  // this.setValueMapping(data);
  return tableStats;
}
