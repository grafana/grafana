import React, { CSSProperties } from 'react';
import { ToggleButtonGroup } from './ToggleButtonGroup';
import { ToggleButton } from './ToggleButton';
import { storiesOf } from '@storybook/react';

const wrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
};

storiesOf('UI/ToggleButtonGroup', module)
  .add('default', () => {
    return (
      <ToggleButtonGroup label="Label (md)">
        <ToggleButton selected={true}>First option</ToggleButton>
        <ToggleButton selected={false}>Second option</ToggleButton>
        <ToggleButton selected={true} tooltip="This is important">
          Third option
        </ToggleButton>
        <ToggleButton selected={false}>Fourth option</ToggleButton>
      </ToggleButtonGroup>
    );
  })
  .add('sizes', () => {
    return (
      <div style={wrapperStyle}>
        <ToggleButtonGroup label="X-Small (xs)">
          <ToggleButton size="xs" selected={true}>
            First option
          </ToggleButton>
          <ToggleButton size="xs" selected={false}>
            Second option
          </ToggleButton>
          <ToggleButton size="xs" selected={true} tooltip="This is important">
            Third option
          </ToggleButton>
          <ToggleButton size="xs" selected={false}>
            Fourth option
          </ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup label="Small (sm)">
          <ToggleButton size="sm" selected={true}>
            First option
          </ToggleButton>
          <ToggleButton size="sm" selected={false}>
            Second option
          </ToggleButton>
          <ToggleButton size="sm" selected={true} tooltip="This is important">
            Third option
          </ToggleButton>
          <ToggleButton size="sm" selected={false}>
            Fourth option
          </ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup label="Medium, default (md)">
          <ToggleButton selected={true}>First option</ToggleButton>
          <ToggleButton selected={false}>Second option</ToggleButton>
          <ToggleButton selected={true} tooltip="This is important">
            Third option
          </ToggleButton>
          <ToggleButton selected={false}>Fourth option</ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup label="Large (lg)">
          <ToggleButton size="lg" selected={true}>
            First option
          </ToggleButton>
          <ToggleButton size="lg" selected={false}>
            Second option
          </ToggleButton>
          <ToggleButton size="lg" selected={true} tooltip="This is important">
            Third option
          </ToggleButton>
          <ToggleButton size="lg" selected={false}>
            Fourth option
          </ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup label="X-Large (xl)">
          <ToggleButton size="xl" selected={true}>
            First option
          </ToggleButton>
          <ToggleButton size="xl" selected={false}>
            Second option
          </ToggleButton>
          <ToggleButton size="xl" selected={true} tooltip="This is important">
            Third option
          </ToggleButton>
          <ToggleButton size="xl" selected={false}>
            Fourth option
          </ToggleButton>
        </ToggleButtonGroup>
      </div>
    );
  });
