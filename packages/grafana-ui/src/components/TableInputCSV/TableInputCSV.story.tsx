import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';

import { DataFrame } from '@grafana/data';

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
