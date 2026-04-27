import { action } from '@storybook/addon-actions';
import { type Meta, type StoryFn } from '@storybook/react';

import type { DataFrame } from '@grafana/data/dataframe';

import { TableInputCSV } from './TableInputCSV';

const meta: Meta<typeof TableInputCSV> = {
  title: 'Inputs/Deprecated/TableInputCSV',
  component: TableInputCSV,
};

export const basic: StoryFn<typeof TableInputCSV> = () => {
  return (
    <TableInputCSV
      width={400}
      height={'90vh'}
      text={'a,b,c\n1,2,3'}
      onSeriesParsed={(data: DataFrame[], text: string) => {
        action('Data')(data, text);
      }}
    />
  );
};

export default meta;
