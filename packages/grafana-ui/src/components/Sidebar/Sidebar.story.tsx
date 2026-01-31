import { css } from '@emotion/css';
import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';

import { Button } from '../Button/Button';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';

import { Sidebar, SidebarPosition, useSidebar } from './Sidebar';
import mdx from './Sidebar.mdx';

interface StoryProps {
  position: SidebarPosition;
  autoHide?: boolean;
  autoHideTimeout?: number;
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
    autoHide: false,
    autoHideTimeout: 10000,
  },
  argTypes: {
    position: { control: { type: 'radio' }, options: ['right', 'left'] },
    autoHide: {
      control: { type: 'boolean' },
      description: 'Enable auto-hide functionality (only works in undocked mode)',
    },
    autoHideTimeout: {
      control: { type: 'number', min: 1000, max: 30000, step: 500 },
      description: 'Auto-hide timeout in milliseconds (only used when autoHide is true)',
    },
  },
};

export const Example: StoryFn<StoryProps> = (args) => {
  const [openPane, setOpenPane] = useState('');

  const containerStyle = css({
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

  const contextValue = useSidebar({
    hasOpenPane: !!openPane,
    position: args.position,
    bottomMargin: 0,
    edgeMargin: 0,
    onClosePane: () => setOpenPane(''),
    autoHide: args.autoHide,
    autoHideTimeout: args.autoHideTimeout,
  });

  return (
    <Box padding={2} backgroundColor={'canvas'} maxWidth={100} borderStyle={'solid'} borderColor={'weak'}>
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
              <Sidebar.PaneHeader title="Settings">
                <Button variant="secondary" size="sm">
                  Action
                </Button>
              </Sidebar.PaneHeader>
            </Sidebar.OpenPane>
          )}
          {openPane === 'outline' && (
            <Sidebar.OpenPane>
              <Sidebar.PaneHeader title="Outline" />
            </Sidebar.OpenPane>
          )}
          {openPane === 'add' && (
            <Sidebar.OpenPane>
              <Sidebar.PaneHeader title="Add element" />
            </Sidebar.OpenPane>
          )}
          <Sidebar.Toolbar>
            <Sidebar.Button
              icon="plus"
              title="Add"
              tooltip="Add element"
              active={openPane === 'add'}
              onClick={() => togglePane('add')}
            />

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
            <Sidebar.Divider />
            <Sidebar.Button icon="info-circle" title="Insights" />
            <Sidebar.Button icon="code-branch" title="Integrations" />
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
    flexGrow: 1,
    height: '600px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    gap: '16px',
  });

  const vizWrapper = css({
    height: '30%',
    display: 'flex',
  });

  const contextValue = useSidebar({
    position: args.position,
    tabsMode: true,
    edgeMargin: 0,
  });

  return (
    <Box padding={2} backgroundColor={'canvas'} maxWidth={100} borderStyle={'solid'} borderColor={'weak'}>
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

export const WithAutoHide: StoryFn = () => {
  const [openPane, setOpenPane] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  const containerStyle = css({
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

  const contextValue = useSidebar({
    hasOpenPane: !!openPane,
    position: 'right',
    bottomMargin: 0,
    edgeMargin: 0,
    onClosePane: () => setOpenPane(''),
    autoHide: true,
  });

  const handlePause = () => {
    contextValue.pauseAutoHide?.();
    setIsPaused(true);
  };

  const handleResume = () => {
    contextValue.resumeAutoHide?.();
    setIsPaused(false);
  };

  return (
    <Box padding={2} backgroundColor="canvas" maxWidth={100} borderStyle="solid" borderColor="weak">
      <Box marginBottom={2} padding={2} backgroundColor="secondary">
        <Stack gap={1} direction="column">
          <p>
            <strong>Auto-Hide Demo:</strong> Open any pane and it will automatically close after 10 seconds of
            inactivity (only when undocked). Interact with the sidebar (click, move mouse) to reset the timer. Try
            docking the sidebar to see that auto-hide is disabled in docked mode. You can also use the following buttons
            to set pause/resume the auto-hide timer.
          </p>
          <Stack gap={1} direction="row">
            <Button variant="secondary" size="sm" onClick={handlePause} disabled={isPaused}>
              Pause Auto-Hide
            </Button>
            <Button variant="secondary" size="sm" onClick={handleResume} disabled={!isPaused}>
              Resume Auto-Hide
            </Button>
          </Stack>
        </Stack>
      </Box>
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
              <Sidebar.PaneHeader title="Settings">
                <Button variant="secondary" size="sm">
                  Action
                </Button>
              </Sidebar.PaneHeader>
            </Sidebar.OpenPane>
          )}
          <Sidebar.Toolbar>
            <Sidebar.Button
              icon="cog"
              title="Settings"
              active={openPane === 'settings'}
              onClick={() => togglePane('settings')}
            />
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
