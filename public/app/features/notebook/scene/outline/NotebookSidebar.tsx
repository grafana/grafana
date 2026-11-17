import { css } from '@emotion/css';
import { useState } from 'react';
import { useMedia } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Sidebar, useSidebar, useStyles2, useTheme2 } from '@grafana/ui';

import { type NotebookScene } from '../NotebookScene';

import { NotebookOutline } from './NotebookOutline';

interface Props {
  scene: NotebookScene;
  /** Height of everything sticky above the document — the app header plus the controls row. */
  stickyTop: number;
}

/**
 * The same right-hand sidebar the dashboard has, holding the same content outline pane.
 *
 * The Sidebar positions itself absolutely inside its parent and expects that parent to stay in view,
 * which the dashboard gets by scrolling inside its own container. A notebook scrolls the page itself,
 * so the parent here is a sticky rail one viewport tall, sized to the space useSidebar reserves.
 */
export function NotebookSidebar({ scene, stickyTop }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.values.sm}px)`);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  // Held here rather than in the pane, which unmounts whenever it closes.
  const [collapsedState] = useState(() => new Map<string, boolean>());

  const sidebarContext = useSidebar({
    hasOpenPane: isOutlineOpen,
    contentMargin: 1,
    position: 'right',
    persistenceKey: 'notebook',
    onClosePane: () => setIsOutlineOpen(false),
    defaultIsHidden: isMobile,
  });

  return (
    <div
      className={styles.rail}
      style={{
        top: stickyTop,
        height: `calc(100vh - ${stickyTop}px)`,
        width: sidebarContext.outerWrapperProps.style?.paddingRight,
      }}
    >
      <Sidebar contextValue={sidebarContext}>
        {isOutlineOpen && (
          <Sidebar.OpenPane>
            <NotebookOutline scene={scene} stickyTop={stickyTop} collapsedState={collapsedState} />
          </Sidebar.OpenPane>
        )}
        <Sidebar.Toolbar>
          <div className={styles.viewGroup}>
            <Sidebar.Button
              icon="list-ui-alt"
              onClick={() => setIsOutlineOpen(!isOutlineOpen)}
              title={t('notebook.sidebar.outline.title', 'Outline')}
              tooltip={t('notebook.sidebar.outline.tooltip', 'Content outline')}
              data-testid={selectors.pages.Notebooks.Item.outlineButton}
              active={isOutlineOpen}
            />
            <Sidebar.Divider />
            <Sidebar.Button
              icon="arrow-to-right"
              onClick={(event) => {
                setIsOutlineOpen(false);
                sidebarContext.setIsHidden(true);
                event.currentTarget.blur();
              }}
              title={t('grafana-ui.sidebar.hide', 'Hide')}
              data-testid={selectors.components.Sidebar.showHideToggle}
            />
          </div>
        </Sidebar.Toolbar>
      </Sidebar>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  rail: css({
    position: 'sticky',
    alignSelf: 'flex-start',
    flexShrink: 0,
    '@media print': {
      display: 'none',
    },
  }),
  // Same as the view group in DashboardSidebarRenderer, which is where the toolbar's top inset comes from.
  viewGroup: css({
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  }),
});
