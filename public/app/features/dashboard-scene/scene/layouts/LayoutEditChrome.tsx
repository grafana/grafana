import { css, cx } from '@emotion/css';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Text, Button, Field, Select, Stack } from '@grafana/ui';

import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';
import { ViewPanelScene } from '../ViewPanelScene';

import { AutomaticGridLayoutManager } from './AutomaticGridLayoutManager';
import { CanvasLayoutManager } from './CanvasLayout/CanvasLayoutManager';
import { ManualGridLayoutManager } from './ManualGridLayoutWrapper';
import { TabsLayoutManager } from './TabsLayoutManager';
import { DashboardLayoutManager, LayoutDescriptor } from './types';

interface Props {
  layoutManager: DashboardLayoutManager;
  children: React.ReactNode;
}

export function LayoutEditChrome({ layoutManager: layout, children }: Props) {
  const styles = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(layout);
  const { isEditing } = getDashboardSceneFor(layout).useState();

  const layouts = getLayouts();
  const options = layouts.map((layout) => ({
    label: layout.name,
    value: layout,
  }));

  const currentLayoutOption = options.find((option) => option.value.id === layout.getLayoutId());

  return (
    <div className={styles.wrapper}>
      {isEditing && (
        <div className={styles.editHeader}>
          <Field label="Layout type">
            <Select
              options={options}
              value={currentLayoutOption}
              onChange={(option) => changeLayoutTo(dashboard, layout, option.value!)}
            />
          </Field>
          {layout.renderEditor?.()}
        </div>
      )}
      {children}
    </div>
  );
}

function getLayouts(): LayoutDescriptor[] {
  return [
    ManualGridLayoutManager.getDescriptor(),
    AutomaticGridLayoutManager.getDescriptor(),
    CanvasLayoutManager.getDescriptor(),
    TabsLayoutManager.getDescriptor(),
  ];
}

function getStyles(theme: GrafanaTheme2) {
  return {
    editHeader: css({
      width: '100%',
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(0, 1, 0.5, 1),
      margin: theme.spacing(1, 0),
      alignItems: 'flex-end',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      paddingBottom: theme.spacing(1),

      '&:hover, &:focus-within': {
        '& > div': {
          opacity: 1,
        },
      },

      '& > div': {
        marginBottom: 0,
        marginRight: theme.spacing(1),
      },
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      minHeight: 0,
    }),
    icon: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      background: 'transparent',
      border: 'none',
      gap: theme.spacing(1),
    }),
    rowTitle: css({}),
    rowActions: css({
      display: 'flex',
      opacity: 0,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'opacity 200ms ease-in',
      },

      '&:hover, &:focus-within': {
        opacity: 1,
      },
    }),
  };
}

function changeLayoutTo(
  dashboard: DashboardScene,
  currentLayout: DashboardLayoutManager,
  newLayout: LayoutDescriptor
): any {
  const newLayoutManager = newLayout.switchTo(currentLayout);
  dashboard.setState({ body: newLayoutManager });
}
