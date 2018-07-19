import _ from 'lodash';
import kbn from '../../../core/utils/kbn';
import { getDecimalsForValue } from '../../../core/utils/ticks';
import TimeSeries from '../../../core/time_series2';
// import TableModel from 'app/core/table_model';
import { PanelModel } from '../../../features/dashboard/panel_model';

type MultistatPanelModel = PanelModel & Panel.MultiStat.PanelOptions;

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
    let tableStat = convertToTableStat(table, panel);
    // this.setValueMapping(seriesStat);
    panelData.push(tableStat);
  }

  return panelData;
}

export function convertToTableStat(table, panel) {
  let tableStat: any = [];

  if (table.length === 0 || table[0][panel.tableColumn] === undefined) {
    return;
  }

  const datapoint = table[0];
  tableStat.value = datapoint[panel.tableColumn];

  if (_.isString(tableStat.value)) {
    tableStat.valueFormatted = _.escape(tableStat.value);
    tableStat.value = 0;
    tableStat.valueRounded = 0;
  } else {
    const decimalInfo = getDecimalsForValue(tableStat.value);
    const formatFunc = kbn.valueFormats[panel.format];
    tableStat.valueFormatted = formatFunc(
      datapoint[panel.tableColumn],
      decimalInfo.decimals,
      decimalInfo.scaledDecimals
    );
    tableStat.valueRounded = kbn.roundValue(tableStat.value, panel.decimals || 0);
  }

  // this.setValueMapping(data);
  return tableStat;
}
