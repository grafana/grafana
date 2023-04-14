import { ComponentMeta, ComponentStory } from '@storybook/react';
import { merge } from 'lodash';
import React from 'react';

import {
  DataFrame,
  FieldType,
  GrafanaTheme2,
  MutableDataFrame,
  ThresholdsConfig,
  ThresholdsMode,
  FieldConfig,
  formattedValueToString,
} from '@grafana/data';
import { Table } from '@grafana/ui';

import { useTheme2 } from '../../themes';
import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';
import { prepDataForStorybook } from '../../utils/storybook/data';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './Table.mdx';
import { FooterItem } from './types';

const meta: ComponentMeta<typeof Table> = {
  title: 'Visualizations/Table',
  component: Table,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['onColumnResize', 'onSortByChange', 'onCellFilterAdded', 'ariaLabel', 'data', 'initialSortBy'],
    },
    docs: {
      page: mdx,
    },
  },
  args: {
    width: 700,
    height: 500,
    columnMinWidth: 130,
  },
};

function buildData(theme: GrafanaTheme2, config: Record<string, FieldConfig>): DataFrame {
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

  for (let i = 0; i < 1000; i++) {
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

function buildSubTablesData(theme: GrafanaTheme2, config: Record<string, FieldConfig>): DataFrame[] {
  const frames: DataFrame[] = [];

  for (let i = 0; i < 1000; i++) {
    const data = new MutableDataFrame({
      meta: {
        custom: {
          parentRowIndex: i,
        },
      },
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

    for (const field of data.fields) {
      field.config = merge(field.config, config[field.name]);
    }

    for (let i = 0; i < Math.random() * 4 + 1; i++) {
      data.appendRow([
        new Date().getTime(),
        Math.random() * 2,
        Math.random() > 0.7 ? 'Good' : 'Bad',
        Math.random() * 100,
      ]);
    }

    frames.push(data);
  }
  return prepDataForStorybook(frames, theme);
}

function buildFooterData(data: DataFrame): FooterItem[] {
  const values = data.fields[3].values.toArray();
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

export const Basic: ComponentStory<typeof Table> = (args) => {
  const theme = useTheme2();
  const data = buildData(theme, {});

  return (
    <DashboardStoryCanvas>
      <Table {...args} data={data} />
    </DashboardStoryCanvas>
  );
};

export const BarGaugeCell: ComponentStory<typeof Table> = (args) => {
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

export const ColoredCells: ComponentStory<typeof Table> = (args) => {
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

export const Footer: ComponentStory<typeof Table> = (args) => {
  const theme = useTheme2();
  const data = buildData(theme, {});
  const footer = buildFooterData(data);

  return (
    <DashboardStoryCanvas>
      <Table {...args} data={data} footerValues={footer} />
    </DashboardStoryCanvas>
  );
};

export const Pagination: ComponentStory<typeof Table> = (args) => <Basic {...args} />;
Pagination.args = {
  enablePagination: true,
};

export const SubTables: ComponentStory<typeof Table> = (args) => {
  const theme = useTheme2();
  const data = buildData(theme, {});
  const subData = buildSubTablesData(theme, {
    Progress: {
      custom: {
        displayMode: 'gradient-gauge',
      },
      thresholds: defaultThresholds,
    },
  });

  return (
    <DashboardStoryCanvas>
      <Table {...args} data={data} subData={subData} />
    </DashboardStoryCanvas>
  );
};

export default meta;
