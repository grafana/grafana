import React, { useState, useEffect } from 'react';
import { Select } from './Select';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../../utils/storybook/withCenteredStory';
import { withStoryContainer } from '../../../utils/storybook/withStoryContainer';
import { SelectableValue } from '@grafana/data';

export default {
  title: 'UI/Forms/Select',
  component: Select,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  // parameters: {
  //   docs: {
  //     page: mdx,
  //   },
  // },
};

export const simple = () => {
  const [value, setValue] = useState<SelectableValue<string>>();

  // const BEHAVIOUR_GROUP = 'Behaviour props';
  // const disabled = boolean('Disabled', false, BEHAVIOUR_GROUP);
  return (
    <div>
      <Select
        options={[
          {
            label: 'Prometheus is a veeeeeeeeeeeeeery long value',
            value: 'prometheus',
          },
          {
            label: 'Graphite',
            value: 'graphite',
          },
          {
            label: 'InlufxDB',
            value: 'inlufxdb',
          },
          {
            label: 'InlufxDB',
            value: 'inlufxdb0',
          },
          {
            label: 'InlufxDB',
            value: 'inlufxdb1',
          },
          {
            label: 'InlufxDB',
            value: 'inlufxdb2',
          },
          {
            label: 'InlufxDB',
            value: 'inlufxdb3',
          },
          {
            label: 'InlufxDB',
            value: 'inlufxdb4',
          },
          {
            label: 'InlufxDB',
            value: 'inlufxdb5',
          },
          {
            label: 'InlufxDB',
            value: 'inlufxdb6',
          },
          {
            label: 'InlufxDB',
            value: 'inlufxdb7',
          },
        ]}
        value={value && value.value}
        onChange={v => {
          setValue(v);
        }}
        size="auto"
        renderOptionLabel={v => {
          return (
            <span>
              {v.value} - {v.label}
            </span>
          );
        }}
      />
      <h1>test</h1>
    </div>
  );
};
