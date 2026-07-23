import { css } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { useStyles2 } from '@grafana/ui';
import { getInternalRadius } from '@grafana/ui/internal';

interface DashboardControlsChromeProps {
  children: React.ReactNode;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
}

/**
 * Shared chrome for the dashboard controls bar on the scrolling dashboard canvas (view + edit). It
 * does two canvas-specific jobs: pins the bar below the fixed app header while the canvas scrolls
 * beneath it, and paints an opaque background over the canvas clip-bleed strip (see scrollContainer
 * in DashboardEditPaneSplitter).
 *
 * Surfaces without those two concerns don't use it. Panel edit is a self-contained editor that
 * manages its own scrolling (including the short-viewport reflow layout) and has no clip-bleed
 * strip, so it renders DashboardControls directly. Embedded dashboards have no app header to pin
 * under and likewise skip it.
 *
 * The spacing below the bar is owned by DashboardControls itself (its bottom padding plus the
 * bottom margin of its children), so consumers should not add their own vertical spacing here.
 */
export function DashboardControlsChrome({ children, onPointerDown }: DashboardControlsChromeProps) {
  const headerHeight = useChromeHeaderHeight();
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const styles = useStyles2(getStyles, headerHeight ?? 0, visualRefreshEnabled);

  return (
    <div className={styles.chrome} onPointerDown={onPointerDown}>
      {children}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2, headerHeight: number, visualRefreshEnabled: boolean) {
  return {
    chrome: css(
      {
        label: 'dashboard-controls-chrome',
        // The dashboard canvas extends its scroll clip box up under this bar (clip-bleed, see
        // scrollContainer in DashboardEditPaneSplitter), so the bar must paint over that strip on
        // every viewport: opaque background plus its own paint order.
        position: 'relative',
        zIndex: 1,
        background: visualRefreshEnabled ? theme.colors.background.page : theme.colors.background.canvas,
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
