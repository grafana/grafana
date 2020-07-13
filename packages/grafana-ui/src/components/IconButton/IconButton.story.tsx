import React from 'react';
import { css } from 'emotion';
import { IconButton } from './IconButton';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { useTheme } from '../../themes/ThemeContext';
import { GrafanaTheme } from '@grafana/data';
import { IconSize, IconName } from '../../types';

export default {
  title: 'Buttons/IconButton',
  component: IconButton,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

export const simple = () => {
  const theme = useTheme();

  return (
    <div>
      {renderScenario(
        'dashboard',
        theme,
        ['sm', 'md', 'lg', 'xl', 'xxl'],
        ['search', 'trash-alt', 'arrow-left', 'times']
      )}
      {renderScenario('panel', theme, ['sm', 'md', 'lg', 'xl', 'xxl'], ['search', 'trash-alt', 'arrow-left', 'times'])}
      {renderScenario('header', theme, ['sm', 'md', 'lg', 'xl', 'xxl'], ['search', 'trash-alt', 'arrow-left', 'times'])}
    </div>
  );
};

function renderScenario(surface: string, theme: GrafanaTheme, sizes: IconSize[], icons: IconName[]) {
  let bg: string = 'red';

  switch (surface) {
    case 'dashboard':
      bg = theme.colors.dashboardBg;
      break;
    case 'panel':
      bg = theme.colors.bodyBg;
      break;
    case 'header': {
      bg = theme.colors.pageHeaderBg;
    }
  }

  return (
    <div
      className={css`
        padding: 30px;
        background: ${bg};
        button {
          margin-right: 8px;
          margin-left: 8px;
          margin-bottom: 8px;
        }
      `}
    >
      {icons.map(icon => {
        return sizes.map(size => (
          <span key={icon + size}>
            <IconButton name={icon} size={size} surface={surface as any} />
          </span>
        ));
      })}
    </div>
  );
}
