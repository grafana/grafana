import { css } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { useStyles2 } from '@grafana/ui';
import { getInternalRadius } from '@grafana/ui/internal';

import { type DashboardScene } from './DashboardScene';

interface DashboardControlsChromeProps {
  dashboard: DashboardScene;
  children: React.ReactNode;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
}

/**
 * Shared chrome for the dashboard controls bar on the scrolling dashboard canvas (view + edit). It
 * does two canvas-specific jobs: pins the bar below the fixed app header while the canvas scrolls
 * beneath it, and paints an opaque background over the canvas clip-bleed strip (see scrollContainer
 * in DashboardSidebarSplitter).
 *
 * Surfaces without those two concerns don't use it. Panel edit is a self-contained editor that
 * manages its own scrolling (including the short-viewport reflow layout) and has no clip-bleed
 * strip, so it renders DashboardControls directly. Embedded dashboards have no app header to pin
 * under and likewise skip it.
 *
 * The spacing below the bar is owned by DashboardControls itself (its bottom padding plus the
 * bottom margin of its children), so consumers should not add their own vertical spacing here.
 *
 * A dashboard with stickyControls set to false opts out of the pinning: the bar then scrolls away
 * with the canvas, the same way it already does on narrow viewports.
 */
export function DashboardControlsChrome({ dashboard, children, onPointerDown }: DashboardControlsChromeProps) {
  const headerHeight = useChromeHeaderHeight();
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const { stickyControls } = dashboard.useState();
  const styles = useStyles2(getStyles, headerHeight ?? 0, visualRefreshEnabled, stickyControls !== false);

  return (
    <div className={styles.chrome} onPointerDown={onPointerDown}>
      {children}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2, headerHeight: number, visualRefreshEnabled: boolean, sticky: boolean) {
  return {
    chrome: css(
      {
        label: 'dashboard-controls-chrome',
        // The dashboard canvas extends its scroll clip box up under this bar (clip-bleed, see
        // scrollContainer in DashboardSidebarSplitter), so the bar must paint over that strip on
        // every viewport: opaque background plus its own paint order.
        position: 'relative',
        // The canvas wrapper next to us is also z-index 1 and comes later in DOM order, so it wins the
        // tie and paints over the time picker and variable overlays, which render inside this wrapper.
        // Enough to clear it, and low enough to stay under the fixed app top bar that the controls row
        // scrolls past on narrow viewports (and on every viewport when the bar is not sticky).
        zIndex: 2,
        background: visualRefreshEnabled ? theme.colors.background.page : theme.colors.background.canvas,
      },
      sticky && {
        [theme.breakpoints.up('md')]: {
          position: 'sticky',
          // above docked dashboard edit Sidebar (zIndex navBarFixed); otherwise time picker popover stays under it.
          zIndex: theme.zIndex.sidemenu,
          top: headerHeight,
        },
      },
      visualRefreshEnabled && {
        borderTopLeftRadius: getInternalRadius(theme, 0, {
          parentBorderRadius: 'lg',
        }),
        borderTopRightRadius: getInternalRadius(theme, 0, {
          parentBorderRadius: 'lg',
        }),
      }
    ),
  };
}
