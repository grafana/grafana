import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { TagsInput } from './TagsInput';

const TagsInputStories = storiesOf('General/TagsInput', module);
const mockTags = ['Some', 'Tags', 'With', 'This', 'New', 'Component'];

TagsInputStories.addDecorator(withCenteredStory);

TagsInputStories.add('default', () => {
  return <TagsInput tags={[]} onChange={tags => action('tags updated')(tags)} />;
});

TagsInputStories.add('with mock tags', () => {
  return (
    <UseState initialState={mockTags}>
      {tags => {
        return <TagsInput tags={tags} onChange={tags => action('tags updated')(tags)} />;
      }}
    </UseState>
  );
});
