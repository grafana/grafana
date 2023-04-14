import { action } from '@storybook/addon-actions';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { DataFrame } from '@grafana/data';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { TableInputCSV } from './TableInputCSV';

const meta: ComponentMeta<typeof TableInputCSV> = {
  title: 'Forms/TableInputCSV',
  component: TableInputCSV,
  decorators: [withCenteredStory],
};

export const basic: ComponentStory<typeof TableInputCSV> = () => {
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
