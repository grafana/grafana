import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withKnobs, object, text } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { SelectOptionItem } from './Select';
import { ButtonSelect } from './ButtonSelect';

const ButtonSelectStories = storiesOf('UI/Select/ButtonSelect', module);

ButtonSelectStories.addDecorator(withCenteredStory).addDecorator(withKnobs);

ButtonSelectStories.add('default', () => {
  const intialState: SelectOptionItem<string> = { label: 'A label', value: 'A value' };
  const value = object<SelectOptionItem<string>>('Selected Value:', intialState);
  const options = object<Array<SelectOptionItem<string>>>('Options:', [
    intialState,
    { label: 'Another label', value: 'Another value' },
  ]);

  return (
    <UseState initialState={value}>
      {(value, updateValue) => {
        return (
          <ButtonSelect
            value={value}
            options={options}
            onChange={value => {
              action('onChanged fired')(value);
              updateValue(value);
            }}
            label={value.label ? value.label : ''}
            className="refresh-select"
            iconClass={text('iconClass', 'fa fa-clock-o fa-fw')}
          />
        );
      }}
    </UseState>
  );
});
