import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { DataFrame } from '@grafana/data';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { TableInputCSV } from './TableInputCSV';

const meta: Meta<typeof TableInputCSV> = {
  title: 'Forms/TableInputCSV',
  component: TableInputCSV,
  decorators: [withCenteredStory],
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
