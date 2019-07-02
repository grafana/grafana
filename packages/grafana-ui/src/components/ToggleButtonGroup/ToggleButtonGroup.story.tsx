import React from 'react';
import { ToggleButton, ToggleButtonGroup } from './ToggleButtonGroup';
import { storiesOf } from '@storybook/react';

storiesOf('UI/ToggleButtonGroup', module).add('basic toggle button group', () => {
  return (
    <ToggleButtonGroup>
      <ToggleButton selected={true}>First option</ToggleButton>
      <ToggleButton selected={false}>Second option</ToggleButton>
      <ToggleButton selected={true} tooltip="This is important">
        Third option
      </ToggleButton>
      <ToggleButton selected={false}>Fourth option</ToggleButton>
    </ToggleButtonGroup>
  );
});
