import React from 'react';
import { NewTable } from './NewTable';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './NewTable.mdx';
import { DataFrame, toDataFrame } from '@grafana/data';

export default {
  title: 'UI/Table/NewTable',
  component: NewTable,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const mockDataFrame: DataFrame = toDataFrame({
  fields: [
    {
      name: 'Time',
      config: {},
      values: [
        1575360770192,
        1575360790192,
        1575360810192,
        1575360830192,
        1575360850192,
        1575360870192,
        1575360890192,
        1575360910192,
        1575360930192,
        1575360950192,
      ],
      type: 'time',
      calcs: null,
    },
    {
      name: 'Message',
      config: {},
      values: [
        'This is a message',
        'This is a message',
        'This is a message',
        'This is a message',
        'This is a message',
        'This is a message',
        'This is a message',
        'This is a message',
        'This is a message',
        'This is a message',
      ],
      type: 'string',
      calcs: null,
    },
    {
      name: 'Description',
      config: {},
      values: [
        'Description',
        'Description',
        'Description',
        'Description',
        'Description',
        'Description',
        'Description',
        'Description',
        'Description',
        'Description',
      ],
      type: 'string',
      calcs: null,
    },
    {
      name: 'Value',
      config: {},
      values: [21, 22, 24, 25, 26, 27, 28, 29, 30, 31],
      type: 'number',
      calcs: null,
    },
  ],
  refId: 'A',
  name: '',
});

export const simple = () => {
  return <NewTable data={mockDataFrame} />;
};
