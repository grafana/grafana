import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withKnobs, object, text } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { SelectableValue } from '@grafana/data';
import { ButtonSelect } from './ButtonSelect';

const ButtonSelectStories = storiesOf('General/Select/ButtonSelect', module);

ButtonSelectStories.addDecorator(withCenteredStory).addDecorator(withKnobs);

ButtonSelectStories.add('default', () => {
  const intialState: SelectableValue<string> = { label: 'A label', value: 'A value' };
  const value = object<SelectableValue<string>>('Selected Value:', intialState);
  const options = object<Array<SelectableValue<string>>>('Options:', [
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
