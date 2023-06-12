import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import { merge } from 'lodash';
import React, { CSSProperties, useState, ReactNode } from 'react';
import { useInterval } from 'react-use';

import { LoadingState } from '@grafana/data';
import { Button, Icon, PanelChrome, PanelChromeProps, RadioButtonGroup } from '@grafana/ui';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { HorizontalGroup } from '../Layout/Layout';
import { Menu } from '../Menu/Menu';

import mdx from './PanelChrome.mdx';

const meta: Meta<typeof PanelChrome> = {
  title: 'Visualizations/PanelChrome',
  component: PanelChrome,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['children'],
    },
    docs: {
      page: mdx,
    },
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

function renderPanel(name: string, overrides?: Partial<PanelChromeProps>) {
  const props: PanelChromeProps = {
    width: 400,
    height: 150,
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

export const Examples = () => {
  const [loading, setLoading] = useState(true);

  useInterval(() => setLoading(true), 5000);

  return (
    <DashboardStoryCanvas>
      <div>
        <HorizontalGroup spacing="md" align="flex-start" wrap>
          {renderPanel('Has statusMessage', {
            title: 'Default title',
            statusMessage: 'Error text',
            statusMessageOnClick: action('ErrorIndicator: onClick fired'),
          })}
          {renderPanel('No padding, has statusMessage', {
            padding: 'none',
            title: 'Default title',
            statusMessage: 'Error text',
            statusMessageOnClick: action('ErrorIndicator: onClick fired'),
          })}
          {renderPanel('No title, loadingState is Error, no statusMessage', {
            loadingState: LoadingState.Error,
          })}
          {renderPanel('loadingState is Streaming', {
            title: 'Default title',
            loadingState: LoadingState.Streaming,
          })}

          {renderPanel('loadingState is Loading', {
            title: 'Default title',
            loadingState: LoadingState.Loading,
          })}

          {renderPanel('Default panel: no non-required props')}
          {renderPanel('No padding', {
            padding: 'none',
          })}
          {renderPanel('Very long title', {
            title: 'Very long title that should get ellipsis when there is no more space',
          })}
          {renderPanel('No title, streaming loadingState', {
            loadingState: LoadingState.Streaming,
          })}
          {renderPanel('Error status, menu', {
            title: 'Default title',
            menu,
            statusMessage: 'Error text',
            statusMessageOnClick: action('ErrorIndicator: onClick fired'),
          })}
          {renderPanel('No padding; has statusMessage, menu', {
            padding: 'none',
            title: 'Default title',
            menu,
            statusMessage: 'Error text',
            statusMessageOnClick: action('ErrorIndicator: onClick fired'),
          })}
          {renderPanel('No title, loadingState is Error, no statusMessage, menu', {
            menu,
            loadingState: LoadingState.Error,
          })}
          {renderPanel('loadingState is Streaming, menu', {
            title: 'Default title',
            menu,
            loadingState: LoadingState.Streaming,
          })}
          {renderPanel('loadingState is Loading, menu', {
            title: 'Default title',
            menu,
            loadingState: LoadingState.Loading,
          })}
          {renderPanel('Deprecated error indicator', {
            title: 'Default title',
            leftItems: [
              <PanelChrome.ErrorIndicator
                key="errorIndicator"
                error="Error text"
                onClick={action('ErrorIndicator: onClick fired')}
              />,
            ],
          })}
          {renderPanel('No padding, deprecated loading indicator', {
            padding: 'none',
            title: 'Default title',
            leftItems: [
              <PanelChrome.LoadingIndicator
                loading={loading}
                onCancel={() => setLoading(false)}
                key="loading-indicator"
              />,
            ],
          })}
          {renderPanel('Display mode = transparent', {
            title: 'Default title',
            displayMode: 'transparent',
            menu,
          })}
          {renderPanel('Actions with button no menu', {
            title: 'Actions with button no menu',
            actions: (
              <Button size="sm" variant="secondary" key="A">
                Breakdown
              </Button>
            ),
          })}
          {renderPanel('Panel with two actions', {
            title: 'I have two buttons',
            actions: [
              <Button size="sm" variant="secondary" key="A">
                Breakdown
              </Button>,
              <Button size="sm" variant="secondary" icon="times" key="B" />,
            ],
          })}
          {renderPanel('With radio button', {
            title: 'I have a radio button',
            actions: [
              <RadioButtonGroup
                key="radio-button-group"
                size="sm"
                value="A"
                options={[
                  { label: 'Graph', value: 'A' },
                  { label: 'Table', value: 'B' },
                ]}
              />,
            ],
          })}
          {renderPanel('Panel with action link', {
            title: 'Panel with action link',
            actions: (
              <a className="external-link" href="/some/page">
                Error details
                <Icon name="arrow-right" />
              </a>
            ),
          })}
          {renderPanel('Action and menu (should be rare)', {
            title: 'Action and menu',
            menu,
            actions: (
              <Button size="sm" variant="secondary">
                Breakdown
              </Button>
            ),
          })}
        </HorizontalGroup>
      </div>
    </DashboardStoryCanvas>
  );
};

export const ExamplesHoverHeader = () => {
  return (
    <DashboardStoryCanvas>
      <div>
        <HorizontalGroup spacing="md" align="flex-start" wrap>
          {renderPanel('Title items, menu, hover header', {
            title: 'Default title',
            description: 'This is a description',
            menu,
            hoverHeader: true,
            dragClass: 'draggable',
            titleItems: (
              <PanelChrome.TitleItem title="Online">
                <Icon name="heart" />
              </PanelChrome.TitleItem>
            ),
          })}
          {renderPanel('Multiple title items', {
            title: 'Default title',
            menu,
            hoverHeader: true,
            dragClass: 'draggable',
            titleItems: [
              <PanelChrome.TitleItem title="Online" key="A">
                <Icon name="heart" />
              </PanelChrome.TitleItem>,
              <PanelChrome.TitleItem title="Link" key="B" onClick={() => {}}>
                <Icon name="external-link-alt" />
              </PanelChrome.TitleItem>,
            ],
          })}
          {renderPanel('Hover header, loading loadingState', {
            loadingState: LoadingState.Loading,
            hoverHeader: true,
            title: 'I am a hover header',
            dragClass: 'draggable',
          })}
          {renderPanel('No title, Hover header', {
            hoverHeader: true,
            dragClass: 'draggable',
          })}
          {renderPanel('Should not have drag icon', {
            title: 'No drag icon',
            hoverHeader: true,
          })}
          {renderPanel('With action link', {
            title: 'With link in hover header',
            hoverHeader: true,
            actions: (
              <a className="external-link" href="/some/page">
                Error details
                <Icon name="arrow-right" />
              </a>
            ),
          })}
        </HorizontalGroup>
      </div>
    </DashboardStoryCanvas>
  );
};

export const Basic: StoryFn<typeof PanelChrome> = (args: PanelChromeProps) => {
  const contentStyle = getContentStyle();

  return (
    <PanelChrome {...args}>
      {(width: number, height: number) => (
        <div style={{ height, width, ...contentStyle }}>Panel in a loading state</div>
      )}
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

const description =
  'Description text with very long descriptive words that describe what is going on in the panel and not beyond. Or maybe beyond, not up to us.';

Basic.argTypes = {
  description: { control: { type: 'text' } },
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
  description,
  menu,
};

export default meta;
