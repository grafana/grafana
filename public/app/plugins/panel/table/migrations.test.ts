import { PanelModel } from '@grafana/data';
import { tablePanelChangedHandler } from './migrations';

describe('Table Migrations', () => {
  it('migrates transform out to core transforms', () => {
    const toColumns = {
      angular: {
        columns: [],
        styles: [],
        transform: 'timeseries_to_columns',
        options: {},
      },
    };
    const toRows = {
      angular: {
        columns: [],
        styles: [],
        transform: 'timeseries_to_rows',
        options: {},
      },
    };
    const toAggregations = {
      angular: {
        columns: [
          {
            text: 'Avg',
            value: 'avg',
            $$hashKey: 'object:82',
          },
          {
            text: 'Max',
            value: 'max',
            $$hashKey: 'object:83',
          },
          {
            text: 'Current',
            value: 'current',
            $$hashKey: 'object:84',
          },
        ],
        styles: [],
        transform: 'timeseries_aggregations',
        options: {},
      },
    };

    const columnsPanel = {} as PanelModel;
    tablePanelChangedHandler(columnsPanel, 'table-old', toColumns);
    expect(columnsPanel).toMatchSnapshot();
    const rowsPanel = {} as PanelModel;
    tablePanelChangedHandler(rowsPanel, 'table-old', toRows);
    expect(rowsPanel).toMatchSnapshot();
    const aggregationsPanel = {} as PanelModel;
    tablePanelChangedHandler(aggregationsPanel, 'table-old', toAggregations);
    expect(aggregationsPanel).toMatchSnapshot();
  });

  it('migrates styles to field config overrides', () => {
    const oldStyles = {
      angular: {
        columns: [],
        styles: [
          {
            alias: 'Time',
            align: 'auto',
            dateFormat: 'YYYY-MM-DD HH:mm:ss',
            pattern: 'Time',
            type: 'date',
            $$hashKey: 'object:195',
          },
          {
            alias: '',
            align: 'auto',
            colorMode: 'cell',
            colors: ['rgba(245, 54, 54, 0.9)', 'rgba(237, 129, 40, 0.89)', 'rgba(50, 172, 45, 0.97)'],
            dateFormat: 'YYYY-MM-DD HH:mm:ss',
            decimals: 2,
            mappingType: 1,
            pattern: 'ColorCell',
            thresholds: ['5', '10'],
            type: 'number',
            unit: 'currencyUSD',
            $$hashKey: 'object:196',
          },
          {
            alias: '',
            align: 'auto',
            colorMode: 'value',
            colors: ['rgba(245, 54, 54, 0.9)', 'rgba(237, 129, 40, 0.89)', 'rgba(50, 172, 45, 0.97)'],
            dateFormat: 'YYYY-MM-DD HH:mm:ss',
            decimals: 2,
            mappingType: 1,
            pattern: 'ColorValue',
            thresholds: ['5', '10'],
            type: 'number',
            unit: 'Bps',
            $$hashKey: 'object:197',
          },
          {
            unit: 'short',
            type: 'number',
            alias: '',
            decimals: 2,
            colors: ['rgba(245, 54, 54, 0.9)', 'rgba(237, 129, 40, 0.89)', 'rgba(50, 172, 45, 0.97)'],
            colorMode: null,
            pattern: '/.*/',
            thresholds: [],
            align: 'right',
          },
        ],
      },
    };
    const panel = {} as PanelModel;
    tablePanelChangedHandler(panel, 'table-old', oldStyles);
    expect(panel).toMatchSnapshot();
  });
});
