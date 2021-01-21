import React from 'react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { RefreshPicker, useTheme } from '@grafana/ui';

export default {
  title: 'Pickers and Editors/RefreshPicker',
  component: RefreshPicker,
  decorators: [withCenteredStory],
};

export const Basic = () => {
  const theme = useTheme();
  return (
    <div style={{ background: theme.colors.dashboardBg, padding: '32px', width: '100%' }}>
      <UseState initialState={'1h'}>
        {(value, updateValue) => {
          return (
            <RefreshPicker
              tooltip="Hello world"
              value={value}
              intervals={['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d']}
              onIntervalChanged={(interval) => {
                action('onIntervalChanged fired')(interval);
              }}
              onRefresh={() => {
                action('onRefresh fired')();
              }}
            />
          );
        }}
      </UseState>
    </div>
  );
};
