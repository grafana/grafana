import React from 'react';
import { css, cx } from 'emotion';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { useTheme } from '../../themes/ThemeContext';

export default {
  title: 'General/ThemeColors',
  component: () => {},
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

interface DemoElement {
  name: string;
  bg: string;
  border?: string;
  textColor?: string;
  child?: DemoElement;
}

function renderElement(el: DemoElement) {
  const style = cx(
    css`
      padding: 36px;
      background: ${el.bg};
    `,
    el.border
      ? css`
          border: 1px solid ${el.border};
        `
      : null
  );

  return (
    <div className={style}>
      <div
        className={css`
          padding: 8px;
        `}
      >
        {el.name}
      </div>
      {el.child && renderElement(el.child)}
    </div>
  );
}

export const BackgroundsAndBorders = () => {
  const theme = useTheme();

  const lvl1 = {
    name: 'dashbord background',
    bg: theme.colors.dashboardBg,
    child: {
      name: 'colors.bg1',
      bg: theme.colors.bg1,
      border: theme.colors.border1,
      child: {
        name:
          'colors.bg2 background used for elements placed on colors.bg1. Using colors.border1 should be used on elements placed ontop of bg1',
        bg: theme.colors.bg2,
        border: theme.colors.border2,
        child: {
          name:
            'colors.bg3 background used for elements placed on colors.bg2 with colors.border2 used for elements placed on bg2',
          bg: theme.colors.bg3,
          border: theme.colors.border2,
        },
      },
    },
  };

  return <div>{renderElement(lvl1)}</div>;
};
