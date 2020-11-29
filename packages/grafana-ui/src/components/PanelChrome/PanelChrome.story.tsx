import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { PanelChrome, useTheme } from '@grafana/ui';
import { Props } from './PanelChrome';
import { VerticalGroup } from '../Layout/Layout';
import { merge } from 'lodash';

export default {
  title: 'Visualizations/PanelChrome',
  component: PanelChrome,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

function renderPanel(name: string, overrides: Partial<Props>) {
  const props: Props = {
    width: 600,
    height: 200,
    title: 'Default title',
    children: () => undefined,
  };

  merge(props, overrides);

  return (
    <PanelChrome {...props}>
      {(innerWidth, innerHeight) => {
        return <div style={{ width: innerWidth, height: innerHeight, background: '#443366' }}>{name}</div>;
      }}
    </PanelChrome>
  );
}

export const StandardPanel = () => {
  const theme = useTheme();

  return (
    <div style={{ background: theme.colors.dashboardBg, padding: 100 }}>
      <VerticalGroup spacing="md">
        {renderPanel('Default panel', {})}
        {renderPanel('No padding', { padding: 'none' })}
        {renderPanel('No title', { title: '' })}
      </VerticalGroup>
    </div>
  );
};
