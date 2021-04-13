import React, { useState } from 'react';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { useInterval } from 'react-use';
import { PanelChrome, PanelPadding } from './PanelChrome';
import { LoadingIndicator } from './LoadingIndicator';
import { ErrorIndicator } from './ErrorIndicator';
import { useTheme } from '../../themes/ThemeContext';

export default {
  title: 'Visualizations/PanelChrome',
  component: PanelChrome,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {},
  },
  argTypes: {
    leftItems: {
      control: {
        type: 'multi-select',
        options: ['none', 'loading', 'error'],
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
  leftItems: string[];
  title: string | undefined;
  padding: PanelPadding;
};

export const StandardPanel = (props: PanelChromeStoryProps) => {
  const theme = useTheme();
  const leftItems = mapToItems(props.leftItems);

  return (
    <div style={{ display: 'flex', height: '500px', alignItems: 'center' }}>
      <PanelChrome {...props} width={400} height={230} leftItems={leftItems}>
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
  leftItems: ['none'],
  title: 'Very long title that should get ellipsis when there is no more space',
};

const LoadingItem = () => {
  const [loading, setLoading] = useState(true);
  useInterval(() => setLoading(true), 5000);

  return <LoadingIndicator loading={loading} onCancel={() => setLoading(false)} />;
};

const mapToItems = (selected: string[]): React.ReactNode[] => {
  return selected.map((s) => {
    switch (s) {
      case 'loading':
        return <LoadingItem key="loading" />;
      case 'error':
        return <ErrorIndicator error="Could not find datasource with id: 12345" onClick={() => {}} />;
      default:
        return null;
    }
  });
};
