import React from 'react';
import { ToggleButton, ToggleButtonGroup } from './ToggleButtonGroup';
import { storiesOf } from '@storybook/react';

storiesOf('UI/ToggleButtonGroup', module).add('basic toggle button group', () => {
  return (
    <ToggleButtonGroup>
      <ToggleButton value={true}>First option</ToggleButton>
      <ToggleButton value={false}>Second option</ToggleButton>
      <ToggleButton value={false}>Second option</ToggleButton>
    </ToggleButtonGroup>
  );
});
