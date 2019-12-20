import React from 'react';
import { NewTable } from './NewTable';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './NewTable.mdx';
import { DataFrame, MutableDataFrame, FieldType } from '@grafana/data';

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

function buildData(): DataFrame {
  const data = new MutableDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [] }, // The time field
      {
        name: 'Value',
        type: FieldType.number,
        values: [],
        config: {
          decimals: 2,
        },
      },
      { name: 'Min', type: FieldType.number, values: [] },
      { name: 'State', type: FieldType.string, values: [] },
    ],
  });

  for (let i = 0; i < 1000; i++) {
    data.appendRow([
      new Date().getTime(),
      Math.random() * 100,
      Math.random() * 100,
      i % 2 === 0 ? 'it is ok now' : 'not so good',
    ]);
  }

  return data;
}

export const simple = () => {
  return (
    <div className="panel-container" style={{ width: 'auto' }}>
      <NewTable data={buildData()} height={500} width={700} />
    </div>
  );
};
