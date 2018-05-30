import Papa from 'papaparse';
import groupBy from 'lodash/groupBy';

import TableModel from 'app/core/table_model';

const filterColumnKeys = key => key && key[0] !== '_' && key !== 'result' && key !== 'table';

const IGNORE_FIELDS_FOR_NAME = ['result', '', 'table'];
export const getNameFromRecord = record => {
  // Measurement and field
  const metric = [record._measurement, record._field];

  // Add tags
  const tags = Object.keys(record)
    .filter(key => key[0] !== '_')
    .filter(key => IGNORE_FIELDS_FOR_NAME.indexOf(key) === -1)
    .map(key => `${key}=${record[key]}`);

  return [...metric, ...tags].join(' ');
};

const parseCSV = (input: string) =>
  Papa.parse(input, {
    header: true,
    comments: '#',
  }).data;

export const parseValue = (input: string) => {
  const value = parseFloat(input);
  return isNaN(value) ? null : value;
};

export const parseTime = (input: string) => Date.parse(input);

export function parseResults(response: string): any[] {
  return response.trim().split(/\n\s*\s/);
}

export function getTableModelFromResult(result: string) {
  const data = parseCSV(result);

  const table = new TableModel();
  if (data.length > 0) {
    // First columns are fixed
    const firstColumns = [
      { text: 'Time', id: '_time' },
      { text: 'Measurement', id: '_measurement' },
      { text: 'Field', id: '_field' },
    ];

    // Dynamically add columns for tags
    const firstRecord = data[0];
    const tags = Object.keys(firstRecord)
      .filter(filterColumnKeys)
      .map(key => ({ id: key, text: key }));

    const valueColumn = { id: '_value', text: 'Value' };
    const columns = [...firstColumns, ...tags, valueColumn];
    columns.forEach(c => table.addColumn(c));

    // Add rows
    data.forEach(record => {
      const row = columns.map(c => record[c.id]);
      table.addRow(row);
    });
  }

  return table;
}

export function getTimeSeriesFromResult(result: string) {
  const data = parseCSV(result);
  if (data.length === 0) {
    return [];
  }

  // Group results by table ID (assume one table per timeseries for now)
  const tables = groupBy(data, 'table');
  const seriesList = Object.keys(tables)
    .map(id => tables[id])
    .map(series => {
      const datapoints = series.map(record => [parseValue(record._value), parseTime(record._time)]);
      const alias = getNameFromRecord(series[0]);
      return { datapoints, target: alias };
    });

  return seriesList;
}
