import { css } from '@emotion/css';
import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';

import { Box } from '../Layout/Box/Box';

import { Sidebar, useSiderbar } from './Sidebar';
import mdx from './Sidebar.mdx';

const meta: Meta<typeof Sidebar> = {
  title: 'Overlays/Sidebar',
  component: Sidebar,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {},
  },
  args: {
    position: 'right',
    compact: true,
  },
  argTypes: {},
};

export const Example: StoryFn<typeof Sidebar> = (args) => {
  const [openPane, setOpenPane] = useState('');

  const containerStyle = css({
    width: '100%',
    flexGrow: 1,
    height: '600px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  });

  const gridStyle = css({
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gridAutoRows: '300px',
    gap: '8px',
    padding: '0 8px',
    flexGrow: 1,
    overflow: 'auto',
  });

  const togglePane = (pane: string) => {
    if (openPane === pane) {
      setOpenPane('');
    } else {
      setOpenPane(pane);
    }
  };

  const { toolbarProps, containerProps, sidebarProps, dockButton, openPaneProps } = useSiderbar({
    isPaneOpen: !!openPane,
    position: args.position,
    compact: args.compact,
  });

  return (
    <Box paddingY={2} backgroundColor={'canvas'} maxWidth={100} borderStyle={'solid'} borderColor={'weak'}>
      <div className={containerStyle} {...containerProps}>
        <div className={gridStyle}>
          {renderBox('A')}
          {renderBox('B')}
          {renderBox('C')}
          {renderBox('D')}
          {renderBox('E')}
          {renderBox('F')}
          {renderBox('G')}
        </div>
        <div {...sidebarProps}>
          {openPane === 'settings' && (
            <div {...openPaneProps}>
              <Sidebar.PaneHeader title="Settings" onClose={() => togglePane('')} />
            </div>
          )}
          {openPane === 'outline' && (
            <div {...openPaneProps}>
              <Sidebar.PaneHeader title="Outline" onClose={() => togglePane('')} />
            </div>
          )}
          <div {...toolbarProps}>
            <Sidebar.Button icon="share-alt" title="Share" toolbarPosition={args.position} compact={args.compact} />
            <Sidebar.Button
              icon="info-circle"
              title="Insights"
              toolbarPosition={args.position}
              compact={args.compact}
            />
            <Sidebar.Divider />
            <Sidebar.Button
              icon="cog"
              title="Settings"
              active={openPane === 'settings'}
              onClick={() => togglePane('settings')}
              toolbarPosition={args.position}
              compact={args.compact}
            />
            <Sidebar.Button
              icon="list-ui-alt"
              title="Outline"
              active={openPane === 'outline'}
              onClick={() => togglePane('outline')}
              toolbarPosition={args.position}
              compact={args.compact}
            />
            {dockButton}
          </div>
        </div>
      </div>
    </Box>
  );
};

export const VerticalTabs: StoryFn = (args) => {
  const [openPane, setOpenPane] = useState('queries');

  const togglePane = (pane: string) => {
    setOpenPane(pane);
  };

  const containerStyle = css({
    width: '100%',
    flexGrow: 1,
    height: '600px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  });

  const vizWrapper = css({
    height: '30%',
    display: 'flex',
    padding: '16px',
  });

  const { toolbarProps, sidebarProps, dockButton, openPaneProps } = useSiderbar({
    position: 'left',
    tabsMode: true,
  });

  return (
    <Box backgroundColor={'canvas'} maxWidth={100} borderStyle={'solid'} borderColor={'weak'}>
      <div className={containerStyle}>
        <div className={vizWrapper}>{renderBox('Visualization')}</div>
        <div {...sidebarProps}>
          {openPane === 'queries' && (
            <div {...openPaneProps}>
              <Sidebar.PaneHeader title="Queries" />
            </div>
          )}
          {openPane === 'transformations' && (
            <div {...openPaneProps}>
              <Sidebar.PaneHeader title="Transformations" />
            </div>
          )}
          <div {...toolbarProps}>
            <Sidebar.Button
              icon="database"
              title="Queries"
              active={openPane === 'queries'}
              onClick={() => togglePane('queries')}
            />
            <Sidebar.Button
              icon="process"
              title="Data"
              tooltip="Data transformations"
              active={openPane === 'transformations'}
              onClick={() => togglePane('transformations')}
            />
            <Sidebar.Button icon="bell" title="Alerts" />
            {dockButton}
          </div>
        </div>
      </div>
    </Box>
  );
};

function renderBox(label: string) {
  return (
    <Box
      backgroundColor={'primary'}
      borderColor={'weak'}
      borderStyle={'solid'}
      justifyContent={'center'}
      alignItems={'center'}
      display={'flex'}
      flex={1}
    >
      {label}
    </Box>
  );
}

export default meta;
