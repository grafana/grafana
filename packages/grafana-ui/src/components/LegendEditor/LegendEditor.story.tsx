import React from 'react';
import { storiesOf } from '@storybook/react';
import { LegendEditor, LegendOptions } from './LegendEditor';
import { action } from '@storybook/addon-actions';
import { UseState } from '../../utils/storybook/UseState';
import { StatID } from '../../types/stats';

storiesOf('UI/LegendEditor', module).add('wip', () => {
  const stats: StatID[] = [StatID.count, StatID.max];
  const options = {
    isVisible: false,
    asTable: false,
    hideEmpty: false,
    hideZero: false,
    stats: [StatID.max],
  } as LegendOptions;

  return (
    <UseState initialState={options}>
      {(currentOptions, updateOptions) => {
        return (
          <LegendEditor
            options={currentOptions}
            stats={stats}
            onChange={newOptions => {
              action('Options changed')(newOptions);
              updateOptions(newOptions);
            }}
          />
        );
      }}
    </UseState>
  );
});
