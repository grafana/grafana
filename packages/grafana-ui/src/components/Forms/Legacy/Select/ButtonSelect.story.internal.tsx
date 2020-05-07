import React from 'react';
import { action } from '@storybook/addon-actions';
import { withKnobs, object, text } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../../../utils/storybook/withCenteredStory';
import { UseState } from '../../../../utils/storybook/UseState';
import { SelectableValue } from '@grafana/data';
import { ButtonSelect } from './ButtonSelect';

export default {
  title: 'Forms/Select/ButtonSelect',
  component: ButtonSelect,
  decorators: [withCenteredStory, withKnobs],
};

export const basic = () => {
  const initialState: SelectableValue<string> = { label: 'A label', value: 'A value' };
  const value = object<SelectableValue<string>>('Selected Value:', initialState);
  const options = object<Array<SelectableValue<string>>>('Options:', [
    initialState,
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
            iconClass={text('iconClass', 'clock-nine')}
          />
        );
      }}
    </UseState>
  );
};
