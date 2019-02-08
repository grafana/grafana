import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { RefreshPicker } from '../../../../../public/app/core/components/RefreshPicker/RefreshPicker';

const RefreshSelectStories = storiesOf('UI/RefreshPicker', module);

RefreshSelectStories.addDecorator(withCenteredStory);

RefreshSelectStories.add('default', () => {
  return (
    <UseState initialState={''}>
      {(value, updateValue) => {
        return (
          <RefreshPicker
            initialValue={value}
            intervals={['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d']}
            onIntervalChanged={interval => {
              action('onIntervalChanged fired')(interval);
              updateValue(interval);
            }}
            onRefreshClicked={() => {
              action('onRefreshClicked fired')();
            }}
          />
        );
      }}
    </UseState>
  );
});
