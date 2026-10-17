import { css } from '@emotion/css';
import { type Meta, type StoryFn } from '@storybook/react';
import { useCallback, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { Stack } from '../Layout/Stack/Stack';

import { TilingLayout } from './TilingLayout';
import { TilingTab } from './TilingTab';
import { useTilingLayout, useTilingView } from './context';
import { createTilingDocument, tilingLayout as L } from './model/spec';
import { type LayoutDocument } from './model/types';
import { type TilingMenuEntry, type TilingPanelInfo, type TilingTabRenderProps, type TilingViewInfo } from './types';

const meta: Meta<typeof TilingLayout> = {
  title: 'Layout/TilingLayout',
  component: TilingLayout,
  parameters: {
    layout: 'fullscreen',
    controls: { exclude: ['layout', 'defaultLayout', 'renderView', 'renderTab', 'renderTabBarActions', 'children'] },
  },
  argTypes: {
    maximize: { control: 'boolean' },
    floating: { control: 'boolean' },
    keepPushed: { control: 'boolean' },
  },
  args: {
    maximize: true,
    floating: true,
    keepPushed: true,
  },
};

export default meta;

const COLORS = ['#3d71d9', '#6e9fff', '#8f3bb8', '#d9534f', '#e68a00', '#3fa45e', '#1f9db5', '#b877d9'];

function createDashboardLayout(): LayoutDocument {
  const v = (id: string, title: string, color: number) => L.view(id, { title, type: 'viz', params: { color } });
  return createTilingDocument(
    L.row(
      [
        L.column(
          [
            L.panel(
              { id: 'panel-overview' },
              v('cpu', 'CPU usage', 0),
              v('memory', 'Memory', 1),
              v('disk', 'Disk I/O', 2)
            ),
            L.row([
              L.panel({ id: 'panel-errors' }, v('errors', 'Error rate', 3)),
              L.panel(v('latency', 'Latency p99', 4)),
            ]),
          ],
          [3, 2]
        ),
        L.column([
          L.panel(v('requests', 'Requests', 5)),
          L.panel(v('logs', 'Logs', 6)),
          L.panel(v('traces', 'Traces', 7)),
        ]),
      ],
      [2, 1]
    )
  );
}

function VizView() {
  const view = useTilingView<{ color: number }>();
  const styles = useStyles2(getStyles);
  const [count, setCount] = useState(0);
  // Shows that content never remounts while it's docked, tabbed, floated or maximized.
  const mountedAt = useRef(new Date().toLocaleTimeString());

  return (
    <div className={styles.view} style={{ borderTop: `3px solid ${COLORS[view.params.color % COLORS.length]}` }}>
      <div className={styles.viewTitle}>{view.title}</div>
      <div className={styles.viewMeta}>
        Mounted at {mountedAt.current} · {view.region} · {view.focused ? 'focused' : 'not focused'}
      </div>
      <Stack gap={1} alignItems="center">
        <Button size="sm" variant="secondary" onClick={() => setCount((c) => c + 1)}>
          Clicked {count} times
        </Button>
        <input className={styles.input} placeholder="Type to keep some state" />
      </Stack>
    </div>
  );
}

function HiddenDock() {
  const { document, restore } = useTilingLayout();
  const styles = useStyles2(getStyles);
  if (!document.hidden.length) {
    return null;
  }
  return (
    <div className={styles.dock}>
      {document.hidden.map((h) => (
        <Button key={h.panel.id} size="sm" variant="secondary" icon="eye" onClick={() => restore(h.panel.id)}>
          {h.panel.views.map((id) => document.views[id]?.title ?? id).join(', ')}
        </Button>
      ))}
    </div>
  );
}

let counter = 0;

function Toolbar() {
  const { openView, maximizedId, stepOut, update } = useTilingLayout();
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.toolbar}>
      <Button
        size="sm"
        icon="plus"
        onClick={() => {
          counter += 1;
          openView(`new-${counter}`, { title: `New panel ${counter}`, type: 'viz', params: { color: counter } });
        }}
      >
        Add panel
      </Button>
      <Button size="sm" variant="secondary" icon="sync" onClick={() => update(() => createDashboardLayout())}>
        Reset layout
      </Button>
      {maximizedId && (
        <Button size="sm" variant="secondary" icon="compress-arrows" onClick={stepOut}>
          Step out (Esc)
        </Button>
      )}
    </div>
  );
}

function renderView() {
  return <VizView />;
}

/**
 * A dashboard-like layout. Drag tabs to reorder or tear them out; drag a tab or a tab bar onto the edge of a
 * panel to split it, onto a gap between panels or the outer edge of the layout to insert there, or onto a tab
 * bar or the middle of a panel to add it as a tab. Double-click a tab bar to maximize, drag the gaps to resize
 * (double-click one to even it out), and use each panel's menu to float, hide, move or close.
 */
export const Basic: StoryFn<typeof TilingLayout> = (args) => {
  const styles = useStyles2(getStyles);
  const [doc, setDoc] = useState(createDashboardLayout);
  return (
    <div className={styles.canvas}>
      <TilingLayout {...args} layout={doc} onLayoutChange={setDoc} renderView={renderView}>
        <HiddenDock />
      </TilingLayout>
    </div>
  );
};

/**
 * Tabs, tab bar actions and menus are customized with plain React: `renderTab`, `renderTabBarActions` and
 * `getPanelMenu`. Buttons inside tabs handle their own clicks without starting a drag.
 */
export const CustomChrome: StoryFn<typeof TilingLayout> = (args) => {
  const styles = useStyles2(getStyles);
  const [doc, setDoc] = useState(createDashboardLayout);
  const [starred, setStarred] = useState<Record<string, boolean>>({});

  const renderTab = useCallback(
    (props: TilingTabRenderProps) => (
      <TilingTab
        {...props}
        prefix={<Icon name="graph-bar" size="sm" />}
        suffix={
          <IconButton
            name={starred[props.view.id] ? 'favorite' : 'star'}
            size="sm"
            aria-label="Star"
            onClick={() => setStarred((s) => ({ ...s, [props.view.id]: !s[props.view.id] }))}
          />
        }
      />
    ),
    [starred]
  );

  const renderTabBarActions = useCallback((panel: TilingPanelInfo) => <PanelActions panel={panel} />, []);

  const getPanelMenu = useCallback(
    (entries: TilingMenuEntry[], panel: TilingPanelInfo): TilingMenuEntry[] => [
      {
        id: 'inspect',
        label: `Inspect ${panel.selectedView.title}`,
        icon: 'info-circle',
        shortcut: 'i',
        onClick: () => alert('Inspect'),
      },
      { id: 'explore', label: 'Explore', icon: 'compass', onClick: () => alert('Explore') },
      'divider',
      ...entries,
    ],
    []
  );

  const isViewClosable = useCallback((view: TilingViewInfo) => view.id !== 'cpu', []);

  return (
    <div className={styles.canvas}>
      <TilingLayout
        {...args}
        layout={doc}
        onLayoutChange={setDoc}
        renderView={renderView}
        renderTab={renderTab}
        renderTabBarActions={renderTabBarActions}
        getPanelMenu={getPanelMenu}
        isViewClosable={isViewClosable}
        emptyState={<span>No panels. Use “Add panel”.</span>}
      >
        <Toolbar />
        <HiddenDock />
      </TilingLayout>
    </div>
  );
};

function PanelActions({ panel }: { panel: TilingPanelInfo }) {
  const { toggleMaximize } = useTilingLayout();
  return (
    <>
      <IconButton name="sync" size="sm" aria-label={`Refresh ${panel.selectedView.title}`} onClick={() => {}} />
      {panel.region === 'docked' && (
        <IconButton
          name={panel.maximized ? 'compress-arrows' : 'expand-arrows'}
          size="sm"
          aria-label={panel.maximized ? 'Restore' : 'Maximize'}
          onClick={() => toggleMaximize(panel.id)}
        />
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  canvas: css({
    position: 'fixed',
    inset: 0,
    padding: theme.spacing(1),
    boxSizing: 'border-box',
    background: theme.colors.background.canvas,
  }),
  view: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    height: '100%',
    padding: theme.spacing(1.5),
    boxSizing: 'border-box',
  }),
  viewTitle: css({
    fontSize: theme.typography.h5.fontSize,
  }),
  viewMeta: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  input: css({
    width: 180,
    padding: theme.spacing(0.5, 1),
    background: theme.components.input.background,
    border: `1px solid ${theme.components.input.borderColor}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
  }),
  dock: css({
    position: 'absolute',
    left: '50%',
    bottom: theme.spacing(2),
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    background: theme.colors.background.elevated,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
  }),
  toolbar: css({
    position: 'absolute',
    right: theme.spacing(2),
    bottom: theme.spacing(2),
    display: 'flex',
    gap: theme.spacing(1),
  }),
});
