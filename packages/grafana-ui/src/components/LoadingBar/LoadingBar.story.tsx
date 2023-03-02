import { css } from '@emotion/css';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { LoadingBar, LoadingBarProps, useStyles2 } from '@grafana/ui';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './LoadingBar.mdx';

const meta: ComponentMeta<typeof LoadingBar> = {
  title: 'General/LoadingBar',
  component: LoadingBar,
  decorators: [withCenteredStory],
  parameters: {
    controls: {},
    docs: {
      page: mdx,
    },
  },
};

const getStyles = (theme: GrafanaTheme2) => {
  const { borderColor } = theme.components.panel;

  return {
    container: css({
      label: 'placeholder-container',
      width: '400px',
      height: '200px',
      border: `1px solid ${borderColor}`,
      borderRadius: '3px',
    }),
  };
};

export const Basic: ComponentStory<typeof LoadingBar> = (args: LoadingBarProps) => {
  const styles = useStyles2(getStyles);

  return (
    <DashboardStoryCanvas>
      <div className={styles.container}>
        <LoadingBar {...args} />
      </div>
    </DashboardStoryCanvas>
  );
};

Basic.args = {
  width: 400,
};

export default meta;
