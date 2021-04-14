import React from 'react';
import { css } from '@emotion/css';
import { IconButton } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { useTheme } from '../../themes';
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
      <RenderScenario layer="layer0" />
      <RenderScenario layer="layer1" />
      <RenderScenario layer="layer2" />
    </div>
  );
};

interface ScenarioProps {
  layer: 'layer0' | 'layer1' | 'layer2';
}

const RenderScenario = ({ layer }: ScenarioProps) => {
  const theme = useTheme();
  const sizes: IconSize[] = ['sm', 'md', 'lg', 'xl', 'xxl'];
  const icons: IconName[] = ['search', 'trash-alt', 'arrow-left', 'times'];

  return (
    <div
      className={css`
        padding: 30px;
        background: ${theme.v2.palette[layer]};
        button {
          margin-right: 8px;
          margin-left: 8px;
          margin-bottom: 8px;
        }
      `}
    >
      <div>{layer}</div>
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
