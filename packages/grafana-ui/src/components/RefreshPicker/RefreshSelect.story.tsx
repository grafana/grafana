import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { RefreshSelect } from '../../../../../public/app/features/dashboard/components/RefreshPicker/RefreshSelect';

const RefreshSelectStories = storiesOf('UI/RefreshPicker/RefreshSelect', module);

RefreshSelectStories.addDecorator(withCenteredStory);

RefreshSelectStories.add('default', () => {
  return (
    <UseState initialState={''}>
      {(value, updateValue) => {
        return (
          <RefreshSelect
            value={value}
            intervals={['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d']}
            onChange={interval => {
              action('onChanged fired')(interval);
              updateValue(interval);
            }}
            isOpen={true}
          />
        );
      }}
    </UseState>
  );
});
