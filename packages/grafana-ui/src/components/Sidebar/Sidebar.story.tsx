import { css } from '@emotion/css';
import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';

import { Button } from '../Button/Button';
import { Box } from '../Layout/Box/Box';

import { Sidebar, SidebarPosition, useSiderbar } from './Sidebar';
import mdx from './Sidebar.mdx';

interface StoryProps {
  position: SidebarPosition;
  compact: boolean;
}

const meta: Meta<StoryProps> = {
  title: 'Overlays/Sidebar',
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
  argTypes: {
    position: { control: { type: 'radio' }, options: ['right', 'left'] },
    compact: { type: 'boolean', options: [true, false] },
  },
};

export const Example: StoryFn<StoryProps> = (args) => {
  const [openPane, setOpenPane] = useState('');

  const containerStyle = css({
    width: '100%',
    flexGrow: 1,
    height: '600px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    padding: '0 8px',
  });

  const gridStyle = css({
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gridAutoRows: '300px',
    gap: '8px',
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

  const contextValue = useSiderbar({
    hasOpenPane: !!openPane,
    position: args.position,
    compact: args.compact,
  });

  return (
    <Box paddingY={2} backgroundColor={'canvas'} maxWidth={100} borderStyle={'solid'} borderColor={'weak'}>
      <div className={containerStyle} {...contextValue.outerWrapperProps}>
        <div className={gridStyle}>
          {renderBox('A')}
          {renderBox('B')}
          {renderBox('C')}
          {renderBox('D')}
          {renderBox('E')}
          {renderBox('F')}
          {renderBox('G')}
        </div>
        <Sidebar contextValue={contextValue}>
          {openPane === 'settings' && (
            <Sidebar.OpenPane>
              <Sidebar.PaneHeader title="Settings" onClose={() => togglePane('')}>
                <Button variant="secondary" size="sm">
                  Action
                </Button>
              </Sidebar.PaneHeader>
            </Sidebar.OpenPane>
          )}
          {openPane === 'outline' && (
            <Sidebar.OpenPane>
              <Sidebar.PaneHeader title="Outline" onClose={() => togglePane('')} />
            </Sidebar.OpenPane>
          )}
          <Sidebar.Toolbar>
            <Sidebar.Button icon="plus" title="Create" />
            <Sidebar.Button icon="info-circle" title="Insights" />
            <Sidebar.Divider />
            <Sidebar.Button
              icon="cog"
              title="Settings"
              active={openPane === 'settings'}
              onClick={() => togglePane('settings')}
            />
            <Sidebar.Button
              icon="list-ui-alt"
              title="Outline"
              active={openPane === 'outline'}
              onClick={() => togglePane('outline')}
            />
          </Sidebar.Toolbar>
        </Sidebar>
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

  const contextValue = useSiderbar({
    position: 'left',
    tabsMode: true,
  });

  return (
    <Box backgroundColor={'canvas'} maxWidth={100} borderStyle={'solid'} borderColor={'weak'}>
      <div className={containerStyle}>
        <div className={vizWrapper}>{renderBox('Visualization')}</div>
        <Sidebar contextValue={contextValue}>
          {openPane === 'queries' && (
            <Sidebar.OpenPane>
              <Sidebar.PaneHeader title="Queries" />
            </Sidebar.OpenPane>
          )}
          {openPane === 'transformations' && (
            <Sidebar.OpenPane>
              <Sidebar.PaneHeader title="Transformations" />
            </Sidebar.OpenPane>
          )}
          <Sidebar.Toolbar>
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
          </Sidebar.Toolbar>
        </Sidebar>
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
