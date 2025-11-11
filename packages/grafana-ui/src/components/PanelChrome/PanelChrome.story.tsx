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
import { TextLink } from '../Link/TextLink';
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

function renderPanel(content: string, overrides?: Partial<PanelChromeProps>) {
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
        return <div style={{ width: innerWidth, height: innerHeight, ...contentStyle }}>{content}</div>;
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
          {renderPanel('Content', {
            title: 'Panel with statusMessage',
            statusMessage: 'Error text',
            statusMessageOnClick: action('ErrorIndicator: onClick fired'),
          })}
          {renderPanel('Content', {
            padding: 'none',
            title: 'Panel with statusMessage and no padding',
            statusMessage: 'Error text',
            statusMessageOnClick: action('ErrorIndicator: onClick fired'),
          })}
          {renderPanel('Content', {
            loadingState: LoadingState.Error,
            title: 'No title, loadingState is Error, no statusMessage',
          })}
          {renderPanel('Content', {
            title: 'loadingState is Streaming',
            loadingState: LoadingState.Streaming,
          })}

          {renderPanel('Content', {
            title: 'loadingState is Loading',
            loadingState: LoadingState.Loading,
          })}

          {renderPanel('Default panel: no non-required props')}
          {renderPanel('Content', {
            padding: 'none',
            title: 'No padding',
          })}
          {renderPanel('Content', {
            title: 'Very long title that should get ellipsis when there is no more space',
          })}
          {renderPanel('Content', {
            title: 'No title, streaming loadingState',
            loadingState: LoadingState.Streaming,
          })}
          {renderPanel('Content', {
            title: 'Error status, menu',
            menu,
            statusMessage: 'Error text',
            statusMessageOnClick: action('ErrorIndicator: onClick fired'),
          })}
          {renderPanel('Content', {
            padding: 'none',
            title: 'No padding; has statusMessage, menu',
            menu,
            statusMessage: 'Error text',
            statusMessageOnClick: action('ErrorIndicator: onClick fired'),
          })}
          {renderPanel('Content', {
            title: 'No title, loadingState is Error, no statusMessage, menu',
            menu,
            loadingState: LoadingState.Error,
          })}
          {renderPanel('Content', {
            title: 'loadingState is Streaming, menu',
            menu,
            loadingState: LoadingState.Streaming,
          })}
          {renderPanel('Content', {
            title: 'loadingState is Loading, menu',
            menu,
            loadingState: LoadingState.Loading,
          })}
          {renderPanel('Content', {
            padding: 'none',
            title: 'No padding, deprecated loading indicator',
            leftItems: [
              <PanelChrome.LoadingIndicator
                loading={loading}
                onCancel={() => setLoading(false)}
                key="loading-indicator"
              />,
            ],
          })}
          {renderPanel('Content', {
            title: 'Display mode = transparent',
            displayMode: 'transparent',
            menu,
          })}
          {renderPanel('Content', {
            title: 'Actions with button no menu',
            actions: (
              <Button size="sm" variant="secondary" key="A">
                Breakdown
              </Button>
            ),
          })}
          {renderPanel('Content', {
            title: 'Panel with two actions',
            actions: [
              <Button size="sm" variant="secondary" key="A">
                Breakdown
              </Button>,
              <Button aria-label="Close" size="sm" variant="secondary" icon="times" key="B" />,
            ],
          })}
          {renderPanel('Content', {
            title: 'With radio button',
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
          {renderCollapsiblePanel('Content', {
            title: 'Collapsible panel',
            collapsible: true,
          })}
          {renderPanel('Content', {
            title: 'Menu always visible',
            showMenuAlways: true,
            menu,
          })}
          {renderPanel('Content', {
            title: 'Panel with action link',
            actions: (
              <TextLink external href="http://www.example.com/some/page">
                Error details
              </TextLink>
            ),
          })}
          {renderPanel('Content', {
            title: 'Action and menu (should be rare)',
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
            title: 'Default title with description',
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
              <TextLink external href="http://www.example.com/some/page">
                Error details
              </TextLink>
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
