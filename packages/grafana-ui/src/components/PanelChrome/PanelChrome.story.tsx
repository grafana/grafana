import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import { merge } from 'lodash';
import { CSSProperties, useState, ReactNode } from 'react';
import { useInterval, useToggle } from 'react-use';

import { LoadingState } from '@grafana/data';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';
import { Button } from '../Button/Button';
import { RadioButtonGroup } from '../Forms/RadioButtonGroup/RadioButtonGroup';
import { Icon } from '../Icon/Icon';
import { Stack } from '../Layout/Stack/Stack';
import { Menu } from '../Menu/Menu';

import { PanelChromeProps } from './PanelChrome';
import mdx from './PanelChrome.mdx';

import { PanelChrome } from '.';

const PANEL_WIDTH = 400;
const PANEL_HEIGHT = 150;

const meta: Meta<typeof PanelChrome> = {
  title: 'Plugins/PanelChrome',
  component: PanelChrome,
  parameters: {
    controls: {
      exclude: ['children'],
    },
    docs: {
      page: mdx,
    },
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
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
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    children: () => undefined,
  };

  merge(props, overrides);

  const contentStyle = getContentStyle();

  return (
    <PanelChrome {...props}>
      {(innerWidth: number, innerHeight: number) => {
        return <div style={{ width: innerWidth, height: innerHeight, ...contentStyle }}>{name}</div>;
      }}
    </PanelChrome>
  );
}

function renderCollapsiblePanel(name: string, overrides?: Partial<PanelChromeProps>) {
  const props: PanelChromeProps = {
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    children: () => undefined,
    collapsible: true,
  };

  merge(props, overrides);

  const contentStyle = getContentStyle();

  const ControlledCollapseComponent = () => {
    const [collapsed, toggleCollapsed] = useToggle(false);

    return (
      <PanelChrome {...props} collapsed={collapsed} onToggleCollapse={toggleCollapsed}>
        {(innerWidth: number, innerHeight: number) => {
          return <div style={{ width: innerWidth, height: innerHeight, ...contentStyle }}>{name}</div>;
        }}
      </PanelChrome>
    );
  };

  return <ControlledCollapseComponent />;
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
        <Stack gap={2} alignItems="flex-start" wrap="wrap">
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
          {renderCollapsiblePanel('Collapsible panel', {
            title: 'Default title',
            collapsible: true,
          })}
          {renderPanel('Menu always visible', {
            title: 'Menu always visible',
            showMenuAlways: true,
            menu,
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
        </Stack>
      </div>
    </DashboardStoryCanvas>
  );
};

export const ExamplesHoverHeader = () => {
  return (
    <DashboardStoryCanvas>
      <div>
        <Stack gap={2} alignItems="flex-start" wrap="wrap">
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
        </Stack>
      </div>
    </DashboardStoryCanvas>
  );
};

export const Basic: StoryFn<typeof PanelChrome> = (overrides?: Partial<PanelChromeProps>) => {
  const args = {
    width: 400,
    height: 200,
    title: 'Very long title that should get ellipsis when there is no more space',
    description,
    menu,
    children: () => undefined,
  };

  merge(args, overrides);

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

const leftItems = { LoadingIcon, Default };

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
        Default: 'Default (no elements)',
      },
    },
  },
};

export default meta;
