import React, { FunctionComponent } from 'react';
import { storiesOf } from '@storybook/react';
import { ColorPickerPopover } from './ColorPickerPopover';
import { withKnobs, select } from '@storybook/addon-knobs';
import { GrafanaTheme } from '../../types';

const CenteredStory: FunctionComponent<{}> = ({ children }) => {
  return (
    <div
      style={{
        height: '100vh  ',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  );
};

storiesOf('UI/ColorPickerPopover', module)
  .addDecorator(story => <CenteredStory>{story()}</CenteredStory>)
  .addDecorator(withKnobs)
  .add('default', () => {
    const selectedTheme = select(
      'Theme',
      {
        Default: '',
        Light: GrafanaTheme.Light,
        Dark: GrafanaTheme.Dark,
      },
      GrafanaTheme.Light
    );
    return (
      <ColorPickerPopover
        color="#BC67E6"
        onChange={color => {
          console.log(color);
        }}
        theme={selectedTheme || undefined}
      />
    );
  });
