import React from 'react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { TagsInput } from '@grafana/ui';

const mockTags = ['Some', 'Tags', 'With', 'This', 'New', 'Component'];

export default {
  title: 'Forms/TagsInput',
  component: TagsInput,
  decorators: [withCenteredStory],
};

export const basic = () => {
  return <TagsInput tags={[]} onChange={tags => action('tags updated')(tags)} />;
};

export const withMockTags = () => {
  return (
    <UseState initialState={mockTags}>
      {tags => {
        return <TagsInput tags={tags} onChange={tags => action('tags updated')(tags)} />;
      }}
    </UseState>
  );
};
