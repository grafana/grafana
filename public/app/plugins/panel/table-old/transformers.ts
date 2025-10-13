import { findIndex, isObject, map } from 'lodash';

import { Column, TableData } from '@grafana/data';
import TableModel, { mergeTablesIntoModel } from 'app/core/TableModel';
import TimeSeries from 'app/core/time_series2';
import flatten from 'app/core/utils/flatten';

import { TableTransform } from './types';

const transformers: { [key: string]: TableTransform } = {};
export const timeSeriesFormatFilterer = (data: any): any[] => {
  if (!Array.isArray(data)) {
    return data.datapoints ? [data] : [];
  }

  return data.reduce((acc, series) => {
    if (!series.datapoints) {
      return acc;
    }

    return acc.concat(series);
  }, []);
};

export const tableDataFormatFilterer = (data: any): any[] => {
  if (!Array.isArray(data)) {
    return data.columns ? [data] : [];
  }

  return data.reduce((acc, series) => {
    if (!series.columns) {
      return acc;
    }

    return acc.concat(series);
  }, []);
};

transformers['timeseries_to_rows'] = {
  description: 'Time series to rows',
  getColumns: () => {
    return [];
  },
  transform: (data, panel, model) => {
    model.columns = [{ text: 'Time', type: 'date' }, { text: 'Metric' }, { text: 'Value' }];
    const filteredData = timeSeriesFormatFilterer(data);

    for (let i = 0; i < filteredData.length; i++) {
      const series = filteredData[i];
      for (let y = 0; y < series.datapoints.length; y++) {
        const dp = series.datapoints[y];
        model.rows.push([dp[1], series.target, dp[0]]);
      }
    }
  },
};

transformers['timeseries_to_columns'] = {
  description: 'Time series to columns',
  getColumns: () => {
    return [];
  },
  transform: (data, panel, model) => {
    model.columns.push({ text: 'Time', type: 'date' });

    // group by time
    const points: any = {};
    const filteredData = timeSeriesFormatFilterer(data);

    for (let i = 0; i < filteredData.length; i++) {
      const series = filteredData[i];
      model.columns.push({ text: series.target });

      for (let y = 0; y < series.datapoints.length; y++) {
        const dp = series.datapoints[y];
        const timeKey = dp[1].toString();

        if (!points[timeKey]) {
          points[timeKey] = { time: dp[1] };
          points[timeKey][i] = dp[0];
        } else {
          points[timeKey][i] = dp[0];
        }
      }
    }

    for (const time in points) {
      const point = points[time];
      const values = [point.time];

      for (let i = 0; i < filteredData.length; i++) {
        const value = point[i];
        values.push(value);
      }

      model.rows.push(values);
    }
  },
};

transformers['timeseries_aggregations'] = {
  description: 'Time series aggregations',
  getColumns: () => {
    return [
      { text: 'Avg', value: 'avg' },
      { text: 'Min', value: 'min' },
      { text: 'Max', value: 'max' },
      { text: 'Total', value: 'total' },
      { text: 'Current', value: 'current' },
      { text: 'Count', value: 'count' },
    ];
  },
  transform: (data, panel, model) => {
    let i, y;
    model.columns.push({ text: 'Metric' });

    for (i = 0; i < panel.columns.length; i++) {
      model.columns.push({ text: panel.columns[i].text });
    }

    const filteredData = timeSeriesFormatFilterer(data);

    for (i = 0; i < filteredData.length; i++) {
      const series = new TimeSeries({
        datapoints: filteredData[i].datapoints,
        alias: filteredData[i].target,
      });

      series.getFlotPairs('connected');
      const cells = [series.alias];

      for (y = 0; y < panel.columns.length; y++) {
        cells.push(series.stats[panel.columns[y].value]);
      }

      model.rows.push(cells);
    }
  },
};

transformers['annotations'] = {
  description: 'Annotations',
  getColumns: () => {
    return [];
  },
  transform: (data, panel, model) => {
    model.columns.push({ text: 'Time', type: 'date' });
    model.columns.push({ text: 'Title' });
    model.columns.push({ text: 'Text' });
    model.columns.push({ text: 'Tags' });

    if (!data || !data.annotations || data.annotations.length === 0) {
      return;
    }

    for (let i = 0; i < data.annotations.length; i++) {
      const evt = data.annotations[i];
      model.rows.push([evt.time, evt.title, evt.text, evt.tags]);
    }
  },
};

transformers['table'] = {
  description: 'Table',
  getColumns: (data) => {
    if (!data || data.length === 0) {
      return [];
    }

    // Single query returns data columns as is
    if (data.length === 1) {
      return [...data[0].columns];
    }

    const filteredData = tableDataFormatFilterer(data);

    // Track column indexes: name -> index
    const columnNames: Record<string, number> = {};

    // Union of all columns
    const columns = filteredData.reduce((acc: Column[], series: TableData) => {
      series.columns.forEach((col) => {
        const { text } = col;
        if (columnNames[text] === undefined) {
          columnNames[text] = acc.length;
          acc.push(col);
        }
      });
      return acc;
    }, []);

    return columns;
  },
  transform: (data: any[], panel, model) => {
    if (!data || data.length === 0) {
      return;
    }
    const filteredData = tableDataFormatFilterer(data);
    const noTableIndex = findIndex(filteredData, (d) => 'columns' in d && 'rows' in d);
    if (noTableIndex < 0) {
      throw {
        message: `Result of query #${String.fromCharCode(
          65 + noTableIndex
        )} is not in table format, try using another transform.`,
      };
    }

    mergeTablesIntoModel(model, ...filteredData);
  },
};

transformers['json'] = {
  description: 'JSON Data',
  getColumns: (data) => {
    if (!data || data.length === 0) {
      return [];
    }

    const names: Record<string, boolean> = {};
    for (let i = 0; i < data.length; i++) {
      const series = data[i];
      if (series.type !== 'docs') {
        continue;
      }

      // only look at 100 docs
      const maxDocs = Math.min(series.datapoints.length, 100);
      for (let y = 0; y < maxDocs; y++) {
        const doc = series.datapoints[y];
        const flattened = flatten(doc, {});
        for (const propName in flattened) {
          names[propName] = true;
        }
      }
    }

    return map(names, (value, key) => {
      return { text: key, value: key };
    });
  },
  transform: (data, panel, model) => {
    let i, y, z;

    for (const column of panel.columns) {
      const tableCol: any = { text: column.text };

      // if filterable data then set columns to filterable
      if (data.length > 0 && data[0].filterable) {
        tableCol.filterable = true;
      }

      model.columns.push(tableCol);
    }

    if (model.columns.length === 0) {
      model.columns.push({ text: 'JSON' });
    }

    for (i = 0; i < data.length; i++) {
      const series = data[i];

      for (y = 0; y < series.datapoints.length; y++) {
        const dp = series.datapoints[y];
        const values = [];

        if (isObject(dp) && panel.columns.length > 0) {
          const flattened = flatten(dp);
          for (z = 0; z < panel.columns.length; z++) {
            values.push(flattened[panel.columns[z].value]);
          }
        } else {
          values.push(JSON.stringify(dp));
        }

        model.rows.push(values);
      }
    }
  },
};

function transformDataToTable(data: any, panel: any) {
  const model = new TableModel();

  if (!data || data.length === 0) {
    return model;
  }

  const transformer = transformers[panel.transform];
  if (!transformer) {
    throw { message: 'Transformer ' + panel.transform + ' not found' };
  }

  transformer.transform(data, panel, model);
  return model;
}

export { transformers, transformDataToTable };
