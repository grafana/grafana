import React from 'react';
import { css } from '@emotion/css';
import { IconButton } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { useTheme2 } from '../../themes';
import { IconSize, IconName } from '../../types';
import mdx from './IconButton.mdx';

export default {
  title: 'Buttons/IconButton',
  component: IconButton,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Simple = () => {
  return (
    <div>
      <RenderScenario background="canvas" />
      <RenderScenario background="primary" />
      <RenderScenario background="secondary" />
    </div>
  );
};

interface ScenarioProps {
  background: 'canvas' | 'primary' | 'secondary';
}

const RenderScenario = ({ background }: ScenarioProps) => {
  const theme = useTheme2();
  const sizes: IconSize[] = ['sm', 'md', 'lg', 'xl', 'xxl'];
  const icons: IconName[] = ['search', 'trash-alt', 'arrow-left', 'times'];

  return (
    <div
      className={css`
        padding: 30px;
        background: ${theme.colors.background[background]};
        button {
          margin-right: 8px;
          margin-left: 8px;
          margin-bottom: 8px;
        }
      `}
    >
      <div>{background}</div>
      {icons.map((icon) => {
        return sizes.map((size) => (
          <span key={icon + size}>
            <IconButton name={icon} size={size} />
          </span>
        ));
      })}
    </div>
  );
};
