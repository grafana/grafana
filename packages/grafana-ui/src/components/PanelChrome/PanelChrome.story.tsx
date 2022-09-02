import { ComponentMeta } from '@storybook/react';
import { merge } from 'lodash';
import React, { CSSProperties, useState } from 'react';
import { useInterval } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { PanelChrome, useTheme2, PanelChromeProps } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { HorizontalGroup, VerticalGroup } from '../Layout/Layout';

const meta: ComponentMeta<typeof PanelChrome> = {
  title: 'Visualizations/PanelChrome',
  component: PanelChrome,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

function renderPanel(name: string, overrides: Partial<PanelChromeProps>, theme: GrafanaTheme2) {
  const props: PanelChromeProps = {
    width: 400,
    height: 130,
    title: 'Default title',
    children: () => undefined,
  };

  merge(props, overrides);

  const contentStyle: CSSProperties = {
    background: theme.colors.background.secondary,
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
  const theme = useTheme2();
  const [loading, setLoading] = useState(true);

  useInterval(() => setLoading(true), 5000);

  return (
    <div style={{ background: theme.colors.background.canvas, padding: 100 }}>
      <HorizontalGroup spacing="md">
        <VerticalGroup spacing="md">
          {renderPanel('Default panel', {}, theme)}
          {renderPanel('No padding', { padding: 'none' }, theme)}
        </VerticalGroup>
        <VerticalGroup spacing="md">
          {renderPanel('No title', { title: '' }, theme)}
          {renderPanel(
            'Very long title',
            { title: 'Very long title that should get ellipsis when there is no more space' },
            theme
          )}
        </VerticalGroup>
      </HorizontalGroup>
      <div style={{ marginTop: theme.spacing(2) }} />
      <HorizontalGroup spacing="md">
        <VerticalGroup spacing="md">
          {renderPanel(
            'No title and loading indicator',
            {
              title: '',
              leftItems: [
                <PanelChrome.LoadingIndicator
                  loading={loading}
                  onCancel={() => setLoading(false)}
                  key="loading-indicator"
                />,
              ],
            },
            theme
          )}
        </VerticalGroup>
        <VerticalGroup spacing="md">
          {renderPanel(
            'Very long title',
            {
              title: 'Very long title that should get ellipsis when there is no more space',
              leftItems: [
                <PanelChrome.LoadingIndicator
                  loading={loading}
                  onCancel={() => setLoading(false)}
                  key="loading-indicator"
                />,
              ],
            },
            theme
          )}
        </VerticalGroup>
      </HorizontalGroup>
    </div>
  );
};

export default meta;
