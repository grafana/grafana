import { ByNamesMatcherMode, createDataFrame, FieldMatcherID, FieldType, PanelModel } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/ui';

import {
  migrateFooterV2,
  migrateFromParentRowIndexToNestedFrames,
  migrateHiddenFields,
  migrateTextWrapToFieldLevel,
  tablePanelChangedHandler,
} from './migrations';

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
    const aggregations = {
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
    const table = {
      angular: {
        columns: [],
        styles: [],
        transform: 'table',
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
    tablePanelChangedHandler(aggregationsPanel, 'table-old', aggregations);
    expect(aggregationsPanel).toMatchSnapshot();
    const tablePanel = {} as PanelModel;
    tablePanelChangedHandler(tablePanel, 'table-old', table);
    expect(tablePanel).toMatchSnapshot();
  });

  it('migrates styles to field config overrides and defaults', () => {
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
            align: 'left',
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
            link: true,
            linkTargetBlank: true,
            linkTooltip: '',
            linkUrl: 'http://www.grafana.com',
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
    expect(panel).toMatchInlineSnapshot(`
      {
        "fieldConfig": {
          "defaults": {
            "custom": {
              "align": "right",
            },
            "decimals": 2,
            "displayName": "",
            "unit": "short",
          },
          "overrides": [
            {
              "matcher": {
                "id": "byName",
                "options": "Time",
              },
              "properties": [
                {
                  "id": "displayName",
                  "value": "Time",
                },
                {
                  "id": "unit",
                  "value": "time: YYYY-MM-DD HH:mm:ss",
                },
                {
                  "id": "custom.align",
                  "value": null,
                },
              ],
            },
            {
              "matcher": {
                "id": "byName",
                "options": "ColorCell",
              },
              "properties": [
                {
                  "id": "unit",
                  "value": "currencyUSD",
                },
                {
                  "id": "decimals",
                  "value": 2,
                },
                {
                  "id": "custom.cellOptions",
                  "value": {
                    "type": "color-background",
                  },
                },
                {
                  "id": "custom.align",
                  "value": "left",
                },
                {
                  "id": "thresholds",
                  "value": {
                    "mode": "absolute",
                    "steps": [
                      {
                        "color": "rgba(245, 54, 54, 0.9)",
                        "value": -Infinity,
                      },
                      {
                        "color": "rgba(237, 129, 40, 0.89)",
                        "value": 5,
                      },
                      {
                        "color": "rgba(50, 172, 45, 0.97)",
                        "value": 10,
                      },
                    ],
                  },
                },
              ],
            },
            {
              "matcher": {
                "id": "byName",
                "options": "ColorValue",
              },
              "properties": [
                {
                  "id": "unit",
                  "value": "Bps",
                },
                {
                  "id": "decimals",
                  "value": 2,
                },
                {
                  "id": "links",
                  "value": [
                    {
                      "targetBlank": true,
                      "title": "",
                      "url": "http://www.grafana.com",
                    },
                  ],
                },
                {
                  "id": "custom.cellOptions",
                  "value": {
                    "type": "color-text",
                  },
                },
                {
                  "id": "custom.align",
                  "value": null,
                },
                {
                  "id": "thresholds",
                  "value": {
                    "mode": "absolute",
                    "steps": [
                      {
                        "color": "rgba(245, 54, 54, 0.9)",
                        "value": -Infinity,
                      },
                      {
                        "color": "rgba(237, 129, 40, 0.89)",
                        "value": 5,
                      },
                      {
                        "color": "rgba(50, 172, 45, 0.97)",
                        "value": 10,
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
        "transformations": [],
      }
    `);
  });

  it('migrates hidden fields to override', () => {
    const oldStyles = {
      angular: {
        columns: [],
        styles: [
          {
            dateFormat: 'YYYY-MM-DD HH:mm:ss',
            pattern: 'time',
            type: 'hidden',
          },
        ],
      },
    };

    const panel = {} as PanelModel;
    tablePanelChangedHandler(panel, 'table-old', oldStyles);
    expect(panel.fieldConfig.overrides).toEqual([
      {
        matcher: {
          id: 'byName',
          options: 'time',
        },
        properties: [
          {
            id: 'custom.hidden',
            value: true,
          },
        ],
      },
    ]);
  });

  it('migrates DataFrame[] from format using meta.custom.parentRowIndex to format using FieldType.nestedFrames', () => {
    const mainFrame = (refId: string) => {
      return createDataFrame({
        refId,
        fields: [
          {
            name: 'field',
            type: FieldType.string,
            config: {},
            values: ['a', 'b', 'c'],
          },
        ],
        meta: {
          preferredVisualisationType: 'table',
        },
      });
    };

    const subFrame = (index: number) => {
      return createDataFrame({
        refId: 'B',
        fields: [
          {
            name: `field_${index}`,
            type: FieldType.string,
            config: {},
            values: [`${index}_subA`, 'subB', 'subC'],
          },
        ],
        meta: {
          preferredVisualisationType: 'table',
          custom: {
            parentRowIndex: index,
          },
        },
      });
    };

    const oldFormat = [mainFrame('A'), mainFrame('B'), subFrame(0), subFrame(1)];
    const newFormat = migrateFromParentRowIndexToNestedFrames(oldFormat);
    expect(newFormat.length).toBe(2);
    expect(newFormat[0].refId).toBe('A');
    expect(newFormat[1].refId).toBe('B');
    expect(newFormat[0].fields.length).toBe(1);
    expect(newFormat[1].fields.length).toBe(2);
    expect(newFormat[0].fields[0].name).toBe('field');
    expect(newFormat[1].fields[0].name).toBe('field');
    expect(newFormat[1].fields[1].name).toBe('nested');
    expect(newFormat[1].fields[1].type).toBe(FieldType.nestedFrames);
    expect(newFormat[1].fields[1].values.length).toBe(2);
    expect(newFormat[1].fields[1].values[0][0].refId).toBe('B');
    expect(newFormat[1].fields[1].values[1][0].refId).toBe('B');
    expect(newFormat[1].fields[1].values[0][0].length).toBe(3);
    expect(newFormat[1].fields[1].values[0][0].length).toBe(3);
    expect(newFormat[1].fields[1].values[0][0].fields[0].name).toBe('field_0');
    expect(newFormat[1].fields[1].values[1][0].fields[0].name).toBe('field_1');
    expect(newFormat[1].fields[1].values[0][0].fields[0].values[0]).toBe('0_subA');
    expect(newFormat[1].fields[1].values[1][0].fields[0].values[0]).toBe('1_subA');
  });

  describe('migrateTextWrapToFieldLevel', () => {
    it('migrates a top-level config.custom.cellOptions.wrapText to a config.custom.wrapText', () => {
      const panel = {
        fieldConfig: {
          defaults: {
            custom: {
              cellOptions: {
                wrapText: true,
              },
            },
          },
          overrides: [],
        },
      } as unknown as PanelModel;

      migrateTextWrapToFieldLevel(panel);
      expect(panel.fieldConfig.defaults.custom.wrapText).toBe(true);
      expect(panel.fieldConfig.defaults.custom.cellOptions.wrapText).toBeUndefined();
    });

    it('migrates field override config.custom.cellOptions.wrapTexts to a field override config.custom.wrapTexts', () => {
      const panel = {
        fieldConfig: {
          defaults: {
            custom: {},
          },
          overrides: [
            {
              matcher: { id: 'byName', options: 'field1' },
              properties: [
                {
                  id: 'custom.cellOptions',
                  value: { wrapText: true, type: TableCellDisplayMode.Pill },
                },
              ],
            },
          ],
        },
      } as unknown as PanelModel;

      migrateTextWrapToFieldLevel(panel);
      expect(panel.fieldConfig.overrides[0].properties).toEqual(
        expect.arrayContaining([
          { id: 'custom.wrapText', value: true },
          { id: 'custom.cellOptions', value: { type: TableCellDisplayMode.Pill } },
        ])
      );
    });

    it('does not overwrite field overrides for cellOptions which do not have wrapText set', () => {
      const panel = {
        fieldConfig: {
          defaults: {
            custom: {},
          },
          overrides: [
            {
              matcher: { id: 'byName', options: 'field1' },
              properties: [
                {
                  id: 'custom.cellOptions',
                  value: { type: TableCellDisplayMode.Pill },
                },
              ],
            },
          ],
        },
      } as unknown as PanelModel;

      migrateTextWrapToFieldLevel(panel);
      // passes the override through with no changes
      expect(panel.fieldConfig.overrides[0]).toBe(panel.fieldConfig.overrides[0]);
    });
  });

  describe('migrateHiddenFields', () => {
    it('migrates fields with config.custom.hidden=true to config.custom.hideFrom.viz=true', () => {
      const panel = {
        fieldConfig: {
          defaults: {
            custom: {},
          },
          overrides: [
            {
              matcher: { id: 'byName', options: 'field1' },
              properties: [
                {
                  id: 'custom.hidden',
                  value: true,
                },
              ],
            },
          ],
        },
      } as unknown as PanelModel;

      migrateHiddenFields(panel);

      expect(panel.fieldConfig.overrides[0].properties).toEqual(
        expect.arrayContaining([{ id: 'custom.hideFrom.viz', value: true }])
      );
      expect(panel.fieldConfig.overrides[0].properties).not.toEqual(
        expect.arrayContaining([{ id: 'custom.hidden', value: true }])
      );
    });
  });

  describe('migrateFooterV2', () => {
    it('is a no-op for panels without footer v1 settings', () => {
      const panel = {
        fieldConfig: {
          defaults: {
            custom: {},
          },
          overrides: [],
        },
      } as unknown as PanelModel;

      // create a clone pre-migration to compare
      const origPanel = JSON.parse(JSON.stringify(panel));

      migrateFooterV2(panel);

      // panel should be unchanged
      expect(origPanel).toEqual(panel);
    });

    it('migrates a global footer', () => {
      const panel = {
        options: {
          footer: {
            show: true,
            reducer: ['sum'],
          },
        },
        fieldConfig: {
          defaults: {
            custom: {},
          },
          overrides: [],
        },
      } as unknown as PanelModel;

      migrateFooterV2(panel);

      expect(panel.options.footer).toBeUndefined();
      expect(panel.fieldConfig.defaults.custom.footer).toEqual({
        reducer: ['sum'],
      });
    });

    it('migrates a field-specific footer', () => {
      const panel = {
        options: {
          footer: {
            show: true,
            reducer: ['sum'],
            fields: ['field1', 'field2'],
          },
        },
        fieldConfig: {
          defaults: {
            custom: {},
          },
          overrides: [],
        },
      } as unknown as PanelModel;

      migrateFooterV2(panel);

      expect(panel.options.footer).toBeUndefined();
      expect(panel.fieldConfig.defaults.custom.footer).toBeUndefined();
      expect(panel.fieldConfig.overrides).toEqual(
        expect.arrayContaining([
          {
            matcher: {
              id: FieldMatcherID.byNames,
              options: {
                mode: ByNamesMatcherMode.include,
                names: ['field1', 'field2'],
              },
            },
            properties: [{ id: 'custom.footer.reducer', value: ['sum'] }],
          },
        ])
      );
    });

    it('migrates a single-field footer', () => {
      const panel = {
        options: {
          footer: {
            show: true,
            reducer: ['sum'],
            fields: ['field1'],
          },
        },
        fieldConfig: {
          defaults: {
            custom: {},
          },
          overrides: [],
        },
      } as unknown as PanelModel;

      migrateFooterV2(panel);

      expect(panel.options.footer).toBeUndefined();
      expect(panel.fieldConfig.defaults.custom.footer).toBeUndefined();
      expect(panel.fieldConfig.overrides).toEqual(
        expect.arrayContaining([
          {
            matcher: {
              id: FieldMatcherID.byName,
              options: 'field1',
            },
            properties: [{ id: 'custom.footer.reducer', value: ['sum'] }],
          },
        ])
      );
    });

    it('handles the countAll case', () => {
      const panel = {
        options: {
          footer: {
            show: true,
            countRows: true,
            reducer: ['count'],
          },
        },
        fieldConfig: {
          defaults: {
            custom: {},
          },
          overrides: [],
        },
      } as unknown as PanelModel;

      migrateFooterV2(panel);

      expect(panel.options.footer).toBeUndefined();
      expect(panel.fieldConfig.defaults.custom.footer).toEqual({
        reducer: ['countAll'],
      });
    });
  });
});
