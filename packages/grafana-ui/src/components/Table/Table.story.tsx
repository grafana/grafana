import { Meta, StoryFn } from '@storybook/react';
import { merge } from 'lodash';

import {
  DataFrame,
  FieldType,
  GrafanaTheme2,
  MutableDataFrame,
  ThresholdsConfig,
  ThresholdsMode,
  FieldConfig,
  formattedValueToString,
  Field,
} from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';
import { prepDataForStorybook } from '../../utils/storybook/data';
import { Button } from '../Button/Button';

import { Table } from './Table';
import mdx from './Table.mdx';
import { FooterItem, TableCellDisplayMode, TableCustomCellOptions } from './types';

const meta: Meta<typeof Table> = {
  title: 'Plugins/Table',
  component: Table,
  parameters: {
    controls: {
      exclude: ['onColumnResize', 'onSortByChange', 'onCellFilterAdded', 'ariaLabel', 'data', 'initialSortBy'],
    },
    docs: {
      page: mdx,
    },
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
  },
  args: {
    width: 700,
    height: 500,
    columnMinWidth: 130,
  },
};

function buildData(theme: GrafanaTheme2, config: Record<string, FieldConfig>, rows = 1000): DataFrame {
  const data = new MutableDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [] }, // The time field
      {
        name: 'Quantity',
        type: FieldType.number,
        values: [],
        config: {
          decimals: 0,
          custom: {
            align: 'center',
            width: 80,
          },
        },
      },
      { name: 'Status', type: FieldType.string, values: [] }, // The time field
      {
        name: 'Value',
        type: FieldType.number,
        values: [],
        config: {
          decimals: 2,
        },
      },
      {
        name: 'Progress',
        type: FieldType.number,
        values: [],
        config: {
          unit: 'percent',
          min: 0,
          max: 100,
          custom: {
            width: 150,
          },
        },
      },
    ],
  });

  for (const field of data.fields) {
    field.config = merge(field.config, config[field.name]);
  }

  for (let i = 0; i < rows; i++) {
    data.appendRow([
      new Date().getTime(),
      Math.random() * 2,
      Math.random() > 0.7 ? 'Active' : 'Cancelled',
      Math.random() * 100,
      Math.random() * 100,
    ]);
  }

  return prepDataForStorybook([data], theme)[0];
}

function buildSubTablesData(theme: GrafanaTheme2, config: Record<string, FieldConfig>, rows: number): DataFrame {
  const data = buildData(theme, {}, rows);
  const allNestedFrames: DataFrame[][] = [];

  for (let i = 0; i < rows; i++) {
    const nestedFrames: DataFrame[] = [];

    for (let i = 0; i < Math.random() * 3; i++) {
      const nestedData = new MutableDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [] }, // The time field
          {
            name: 'Quantity',
            type: FieldType.number,
            values: [],
            config: {
              decimals: 0,
              custom: {
                align: 'center',
              },
            },
          },
          { name: 'Quality', type: FieldType.string, values: [] }, // The time field
          {
            name: 'Progress',
            type: FieldType.number,
            values: [],
            config: {
              unit: 'percent',
              min: 0,
              max: 100,
            },
          },
        ],
      });

      for (const field of nestedData.fields) {
        field.config = merge(field.config, config[field.name]);
      }

      for (let i = 0; i < Math.random() * 4; i++) {
        nestedData.appendRow([
          new Date().getTime(),
          Math.random() * 2,
          Math.random() > 0.7 ? 'Good' : 'Bad',
          Math.random() * 100,
        ]);
      }

      nestedFrames.push(nestedData);
    }

    allNestedFrames.push(prepDataForStorybook(nestedFrames, theme));
  }

  data.fields = [
    ...data.fields,
    {
      name: 'nested',
      type: FieldType.nestedFrames,
      values: allNestedFrames,
      config: {},
    },
  ];

  return data;
}

function buildFooterData(data: DataFrame): FooterItem[] {
  const values = data.fields[3].values;
  const valueSum = values.reduce((prev, curr) => {
    return prev + curr;
  }, 0);

  const valueField = data.fields[3];
  const displayValue = valueField.display ? valueField.display(valueSum) : valueSum;
  const val = valueField.display ? formattedValueToString(displayValue) : displayValue;

  const sum = { sum: val };
  const min = { min: String(5.2) };
  const valCell = [sum, min];

  return ['Totals', '10', undefined, valCell, '100%'];
}

const defaultThresholds: ThresholdsConfig = {
  steps: [
    {
      color: 'blue',
      value: -Infinity,
    },
    {
      color: 'green',
      value: 20,
    },
  ],
  mode: ThresholdsMode.Absolute,
};

export const Basic: StoryFn<typeof Table> = (args) => {
  const theme = useTheme2();
  const data = buildData(theme, {});

  return (
    <DashboardStoryCanvas>
      <Table {...args} data={data} />
    </DashboardStoryCanvas>
  );
};

export const BarGaugeCell: StoryFn<typeof Table> = (args) => {
  const theme = useTheme2();
  const data = buildData(theme, {
    Progress: {
      custom: {
        width: 200,
        cellOptions: {
          type: 'gauge',
          mode: 'gradient',
        },
      },
      thresholds: defaultThresholds,
    },
  });

  return (
    <DashboardStoryCanvas>
      <Table {...args} data={data} />
    </DashboardStoryCanvas>
  );
};

export const ColoredCells: StoryFn<typeof Table> = (args) => {
  const theme = useTheme2();
  const data = buildData(theme, {
    Progress: {
      custom: {
        width: 80,
        displayMode: 'color-background',
      },
      thresholds: defaultThresholds,
    },
  });

  return (
    <DashboardStoryCanvas>
      <Table {...args} data={data} />
    </DashboardStoryCanvas>
  );
};

export const Footer: StoryFn<typeof Table> = (args) => {
  const theme = useTheme2();
  const data = buildData(theme, {});
  const footer = buildFooterData(data);

  return (
    <DashboardStoryCanvas>
      <Table {...args} data={data} footerValues={footer} />
    </DashboardStoryCanvas>
  );
};

export const Pagination: StoryFn<typeof Table> = (args) => <Basic {...args} />;
Pagination.args = {
  enablePagination: true,
};

export const SubTables: StoryFn<typeof Table> = (args) => {
  const theme = useTheme2();
  const data = buildSubTablesData(theme, {}, 100);

  return (
    <DashboardStoryCanvas>
      <Table {...args} data={data} />
    </DashboardStoryCanvas>
  );
};

export const CustomColumn: StoryFn<typeof Table> = (args) => {
  const theme = useTheme2();
  const data = buildData(theme, {});

  const options: TableCustomCellOptions = {
    type: TableCellDisplayMode.Custom,
    cellComponent: (props) => {
      return (
        <Button
          onClick={() =>
            alert(`Canceling order from ${props.frame.fields.find((f) => f.name === 'Time')?.values[props.rowIndex]}`)
          }
        >
          Cancel
        </Button>
      );
    },
  };

  const customCellField: Field = {
    name: 'Actions',
    type: FieldType.other,
    values: [],
    config: {
      decimals: 0,
      custom: {
        cellOptions: options,
      },
    },
    display: () => ({ text: '', numeric: 0 }),
  };

  for (let i = 0; i < data.length; i++) {
    customCellField.values.push(null);
  }

  data.fields = [customCellField, ...data.fields];

  return (
    <DashboardStoryCanvas>
      <Table {...args} data={data} />
    </DashboardStoryCanvas>
  );
};

export default meta;
