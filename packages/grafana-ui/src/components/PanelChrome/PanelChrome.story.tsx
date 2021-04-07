import React, { useState } from 'react';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { useInterval } from 'react-use';
import { PanelChrome, PanelPadding } from './PanelChrome';
import { LoadingIndicator } from './LoadingIndicator';
import { useTheme } from '../../themes/ThemeContext';

export default {
  title: 'Visualizations/PanelChrome',
  component: PanelChrome,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {},
  },
  argTypes: {
    rightItems: {
      control: {
        type: 'select',
        options: ['none', 'loading'],
      },
    },
    width: {
      table: {
        disable: true,
      },
    },
    height: {
      table: {
        disable: true,
      },
    },
  },
};

type PanelChromeStoryProps = {
  rightItems: string;
  title: string | undefined;
  padding: PanelPadding;
  error?: string;
};

export const StandardPanel = (props: PanelChromeStoryProps) => {
  const theme = useTheme();
  const rightItems = mapToItems(props.rightItems);

  return (
    <div style={{ display: 'flex', height: '500px', alignItems: 'center' }}>
      <PanelChrome {...props} width={400} height={230} rightItems={rightItems}>
        {(innerWidth, innerHeight) => {
          return (
            <div
              style={{
                width: innerWidth,
                height: innerHeight,
                ...{
                  background: theme.colors.bg2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              }}
            ></div>
          );
        }}
      </PanelChrome>
    </div>
  );
};

StandardPanel.args = {
  rightItems: 'none',
  title: 'Very long title that should get ellipsis when there is no more space',
};

const LoadingItem = () => {
  const [loading, setLoading] = useState(true);
  useInterval(() => setLoading(true), 5000);

  return <LoadingIndicator loading={loading} onCancel={() => setLoading(false)} />;
};

const mapToItems = (selected: string): React.ReactNode[] | undefined => {
  switch (selected) {
    case 'loading':
      return [<LoadingItem key="loading" />];
    default:
      return;
  }
};
