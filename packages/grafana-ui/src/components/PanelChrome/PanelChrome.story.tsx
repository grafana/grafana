import { action } from '@storybook/addon-actions';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { merge } from 'lodash';
import React, { CSSProperties, useState, ReactNode } from 'react';
import { useInterval } from 'react-use';

import { PanelChrome, PanelChromeProps } from '@grafana/ui';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { HorizontalGroup, VerticalGroup } from '../Layout/Layout';
import { Menu } from '../Menu/Menu';

import { PanelChromeInfoState } from './PanelChrome';

const meta: ComponentMeta<typeof PanelChrome> = {
  title: 'Visualizations/PanelChrome',
  component: PanelChrome,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['children'],
    },
    docs: {},
  },
};

function getContentStyle(): CSSProperties {
  return {
    background: 'rgba(230,0,0,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

function renderPanel(name: string, overrides: Partial<PanelChromeProps>) {
  const props: PanelChromeProps = {
    width: 400,
    height: 130,
    title: 'Default title',
    children: () => undefined,
  };

  merge(props, overrides);

  const contentStyle = getContentStyle();

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
      <HorizontalGroup spacing="md" align="flex-start">
        <VerticalGroup spacing="md">
          {renderPanel('Default panel with error state indicator', {
            title: 'Default title',
            leftItems: [
              <PanelChrome.ErrorIndicator
                key="errorIndicator"
                error="Error text"
                onClick={action('ErrorIndicator: onClick fired')}
              />,
            ],
          })}
          {renderPanel('No padding with error state indicator', {
            padding: 'none',
            title: 'Default title',
            leftItems: [
              <PanelChrome.ErrorIndicator
                key="errorIndicator"
                error="Error text"
                onClick={action('ErrorIndicator: onClick fired')}
              />,
            ],
          })}
        </VerticalGroup>
        <VerticalGroup spacing="md">
          {renderPanel('No title', { title: '' })}
          {renderPanel('Very long title', {
            title: 'Very long title that should get ellipsis when there is no more space',
          })}
        </VerticalGroup>
      </HorizontalGroup>
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

export const Basic: ComponentStory<typeof PanelChrome> = (args: PanelChromeProps) => {
  const contentStyle = getContentStyle();

  return (
    <PanelChrome {...args}>
      {(width: number, height: number) => <div style={{ height, width, ...contentStyle }}>Description text</div>}
    </PanelChrome>
  );
};

const Default: ReactNode = [];
const LoadingIcon = [
  <PanelChrome.LoadingIndicator key="loadingIndicator" loading onCancel={action('LoadingIndicator: onCancel fired')} />,
];
const ErrorIcon = [
  <PanelChrome.ErrorIndicator
    key="errorIndicator"
    error="Error text"
    onClick={action('ErrorIndicator: onClick fired')}
  />,
];

const leftItems = { LoadingIcon, ErrorIcon, Default };

const titleItems: PanelChromeInfoState[] = [
  {
    icon: 'info',
    tooltip:
      'Description text with very long descriptive words that describe what is going on in the panel and not beyond. Or maybe beyond, not up to us.',
  },
  {
    icon: 'external-link-alt',
    tooltip: 'wearegoingonanadventure.openanewtab.maybe',
    onClick: () => {},
  },
  {
    icon: 'clock-nine',
    tooltip: 'Time range: 2021-09-01 00:00:00 to 2021-09-01 00:00:00',
    onClick: () => {},
  },
  {
    icon: 'heart',
    tooltip: 'Health of the panel',
  },
];

const menu = (
  <Menu>
    <Menu.Item label="View" icon="eye" />
    <Menu.Item label="Edit" icon="edit" />
    <Menu.Item label="Share" icon="share-alt" />
    <Menu.Item label="Explore" icon="compass" />
    <Menu.Item
      label="Inspect"
      icon="info-circle"
      childItems={[
        <Menu.Item key="subitem1" label="Data" />,
        <Menu.Item key="subitem2" label="Query" />,
        <Menu.Item key="subitem3" label="Panel JSON" />,
      ]}
    />
    <Menu.Item
      label="More"
      icon="cube"
      childItems={[
        <Menu.Item key="subitem1" label="Duplicate" />,
        <Menu.Item key="subitem2" label="Copy" />,
        <Menu.Item key="subitem3" label="Create library panel" />,
        <Menu.Item key="subitem4" label="Hide legend" />,
        <Menu.Item key="subitem5" label="Get help" />,
      ]}
    />
    <Menu.Divider />
    <Menu.Item label="Remove" icon="trash-alt" />
  </Menu>
);

Basic.argTypes = {
  leftItems: {
    options: Object.keys(leftItems),
    mapping: leftItems,
    control: {
      type: 'select',
      labels: {
        LoadingIcon: 'With loading icon',
        ErrorIcon: 'With error icon',
        Default: 'Default (no elements)',
      },
    },
  },
};

Basic.args = {
  width: 400,
  height: 200,
  title: 'Very long title that should get ellipsis when there is no more space',
  titleItems,
  menu,
};

export default meta;
