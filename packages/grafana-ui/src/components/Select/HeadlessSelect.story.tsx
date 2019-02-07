import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withKnobs, object, boolean } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { HeadlessSelect } from './HeadlessSelect';
import { SelectOptionItem } from './Select';

const HeadlessSelectStories = storiesOf('UI/Select/HeadlessSelect', module);

HeadlessSelectStories.addDecorator(withCenteredStory).addDecorator(withKnobs);

HeadlessSelectStories.add('default', () => {
  const intialState: SelectOptionItem = { label: 'A label', value: 'A value' };
  const value = object<SelectOptionItem>('Selected Value:', intialState);
  const options = object<SelectOptionItem[]>('Options:', [
    intialState,
    { label: 'Another label', value: 'Another value' },
  ]);

  const menuIsOpen = boolean('Is dropdown open', true);
  return (
    <UseState initialState={value}>
      {(value, updateValue) => {
        return (
          <HeadlessSelect
            value={value}
            options={options}
            onChange={value => {
              action('onChanged fired')(value);
              updateValue(value);
            }}
            menuIsOpen={menuIsOpen}
          />
        );
      }}
    </UseState>
  );
});
