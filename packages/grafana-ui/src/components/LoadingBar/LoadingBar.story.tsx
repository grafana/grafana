import { css } from '@emotion/css';
import { Meta, StoryFn } from '@storybook/react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';

import { LoadingBar, LoadingBarProps } from './LoadingBar';
import mdx from './LoadingBar.mdx';

const meta: Meta<typeof LoadingBar> = {
  title: 'Information/LoadingBar',
  component: LoadingBar,
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
      borderRadius: theme.shape.radius.default,
    }),
  };
};

export const Basic: StoryFn<typeof LoadingBar> = (args: LoadingBarProps) => {
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
