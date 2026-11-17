import { css, cx } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

import { PageCanvasTabs, pageCanvasTabElementId } from './PageCanvasTabs';
import { type PageCanvasModel } from './types';
import { usePageCanvasShortcuts } from './usePageCanvasShortcuts';

export const PAGE_CANVAS_PANE_ID = 'page-canvas-pane';

interface Props {
  canvas: PageCanvasModel | null;
  /** The plugin's component, kept mounted in the pane. */
  pane: ReactNode;
  className?: string;
  /** Renders `<main>`. `covered` is true while a pane tab covers the page, which then stays mounted but inert. */
  renderPage(covered: boolean): ReactNode;
}

/** Whether the active tab covers the page: a pane tab does, and so does the reopen state when every tab is closed. */
export function isPageCovered(canvas: PageCanvasModel | null): boolean {
  if (!canvas) {
    return false;
  }
  return canvas.tabs.find((tab) => tab.id === canvas.activeTabId)?.shows !== 'page';
}

/**
 * The page area with a canvas: its tab strip, then the pane and the page. The tree is the same with or without a
 * canvas, so opening, closing or switching tabs never remounts the page.
 */
export function PageCanvasFrame({ canvas, pane, className, renderPage }: Props) {
  const styles = useStyles2(getStyles);
  usePageCanvasShortcuts(canvas);
  const covered = isPageCovered(canvas);
  const allClosed = canvas !== null && canvas.tabs.length === 0;

  return (
    <div className={cx(styles.frame, className)}>
      {canvas && <PageCanvasTabs canvas={canvas} paneId={PAGE_CANVAS_PANE_ID} />}
      <div className={styles.body}>
        <div
          id={PAGE_CANVAS_PANE_ID}
          className={cx(styles.pane, covered && styles.paneCovering)}
          role={covered ? 'tabpanel' : undefined}
          aria-labelledby={covered && canvas && !allClosed ? pageCanvasTabElementId(canvas.activeTabId) : undefined}
          data-testid="page-canvas-pane"
        >
          {allClosed && (
            <div className={styles.closedState}>
              <h2 className={styles.closedHeading}>{t('app-chrome.page-canvas.all-closed', 'All tabs are closed')}</h2>
              <p className={styles.closedText}>
                {t(
                  'app-chrome.page-canvas.all-closed-hint',
                  'Press Alt+Shift+T to reopen the last one, or reopen them all.'
                )}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => canvas.onReopen(canvas.closedTabs.map((tab) => tab.id))}
              >
                {t('app-chrome.page-canvas.reopen-all', 'Reopen all tabs')}
              </Button>
            </div>
          )}
          {pane}
        </div>
        {renderPage(covered)}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  frame: css({
    label: 'page-canvas-frame',
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minWidth: 0,
    minHeight: 0,
  }),
  body: css({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minHeight: 0,
    // A covered page's own stacking (sticky toolbars, raised rows) stays under the pane instead of painting over it.
    '& > [inert]': {
      isolation: 'isolate',
    },
  }),
  pane: css({
    display: 'none',
  }),
  paneCovering: css(
    {
      display: 'flex',
      flexDirection: 'column',
      position: 'absolute',
      inset: 0,
      zIndex: 1,
      overflow: 'auto',
      background: theme.colors.background.canvas,
    },
    // The same card body as the page it covers: below the strip's divider, with the page card's gaps and corners.
    theme.flags.visualDesignRefresh && {
      inset: theme.spacing(0, 0.5, 0.5),
      border: `1px solid ${theme.colors.border.weak}`,
      borderTop: 'none',
      borderBottomLeftRadius: theme.shape.radius.lg,
      borderBottomRightRadius: theme.shape.radius.lg,
      background: theme.colors.background.page,
    }
  ),
  closedState: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(1),
    margin: 'auto',
    padding: theme.spacing(4),
    textAlign: 'center',
  }),
  closedHeading: css({
    margin: 0,
    fontSize: theme.typography.h4.fontSize,
  }),
  closedText: css({
    margin: 0,
    color: theme.colors.text.secondary,
  }),
});
