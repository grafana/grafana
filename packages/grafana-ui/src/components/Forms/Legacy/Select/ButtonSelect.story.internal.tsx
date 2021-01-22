import React, { FC } from 'react';
import { action } from '@storybook/addon-actions';
import { withKnobs, object } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../../../utils/storybook/withCenteredStory';
import { UseState } from '../../../../utils/storybook/UseState';
import { SelectableValue } from '@grafana/data';
import { ButtonSelect } from './ButtonSelect';
import { DashboardStoryCanvas } from '../../../../utils/storybook/StoryBackground';

export default {
  title: 'Forms/Select/ButtonSelect',
  component: ButtonSelect,
  decorators: [withCenteredStory, withKnobs],
};

export const Basic: FC = () => {
  const initialState: SelectableValue<string> = { label: 'A label', value: 'A value' };
  const value = object<SelectableValue<string>>('Selected Value:', initialState);
  const options = object<Array<SelectableValue<string>>>('Options:', [
    initialState,
    { label: 'Another label', value: 'Another value' },
  ]);

  return (
    <DashboardStoryCanvas>
      <UseState initialState={value}>
        {(value, updateValue) => {
          return (
            <div style={{ marginLeft: '100px' }}>
              <ButtonSelect
                value={value}
                options={options}
                onChange={(value) => {
                  action('onChanged fired')(value);
                  updateValue(value);
                }}
                className="refresh-select"
              />
            </div>
          );
        }}
      </UseState>
    </DashboardStoryCanvas>
  );
};
