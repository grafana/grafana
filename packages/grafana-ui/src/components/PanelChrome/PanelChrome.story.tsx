import React, { CSSProperties, useState } from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { PanelChrome, useTheme, PanelChromeProps } from '@grafana/ui';
import { HorizontalGroup, VerticalGroup } from '../Layout/Layout';
import { merge } from 'lodash';
import { GrafanaTheme } from '@grafana/data';
import { useInterval } from 'react-use';
import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';

export default {
  title: 'Visualizations/PanelChrome',
  component: PanelChrome,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

function renderPanel(name: string, overrides: Partial<PanelChromeProps>) {
  const props: PanelChromeProps = {
    width: 400,
    height: 130,
    title: 'Default title',
    children: () => undefined,
  };

  merge(props, overrides);

  const contentStyle: CSSProperties = {
    background: 'rgb(100,100,100,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <PanelChrome {...props}>
      {(innerWidth, innerHeight) => {
        return <div style={{ width: innerWidth, height: innerHeight, ...contentStyle }}>{name}</div>;
      }}
    </PanelChrome>
  );
}

export const Examples = () => {
  const [loading, setLoading] = useState(true);

  useInterval(() => setLoading(true), 5000);

  return (
    <DashboardStoryCanvas>
      <HorizontalGroup spacing="md">
        <VerticalGroup spacing="md">
          {renderPanel('Default panel', {})}
          {renderPanel('No padding', { padding: 'none' })}
        </VerticalGroup>
        <VerticalGroup spacing="md">
          {renderPanel('No title', { title: '' })}
          {renderPanel('Very long title', {
            title: 'Very long title that should get ellipsis when there is no more space',
          })}
        </VerticalGroup>
      </HorizontalGroup>
      <div style={{ marginTop: '16px' }} />
      <HorizontalGroup spacing="md">
        <VerticalGroup spacing="md">
          {renderPanel('No title and loading indicator', {
            title: '',
            leftItems: [
              <PanelChrome.LoadingIndicator
                loading={loading}
                onCancel={() => setLoading(false)}
                key="loading-indicator"
              />,
            ],
          })}
        </VerticalGroup>
        <VerticalGroup spacing="md">
          {renderPanel('Very long title', {
            title: 'Very long title that should get ellipsis when there is no more space',
            leftItems: [
              <PanelChrome.LoadingIndicator
                loading={loading}
                onCancel={() => setLoading(false)}
                key="loading-indicator"
              />,
            ],
          })}
        </VerticalGroup>
      </HorizontalGroup>
    </DashboardStoryCanvas>
  );
};
