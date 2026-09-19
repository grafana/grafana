import { css, cx } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconButton } from '../IconButton/IconButton';
import { Text } from '../Text/Text';

import { useSidebarContext } from './useSidebar';

export interface Props {
  children?: ReactNode;
  title: string;
}

export function SidebarPaneHeader({ children, title }: Props) {
  const styles = useStyles2(getStyles);
  const sidebarContext = useSidebarContext();

  if (!sidebarContext) {
    throw new Error('SidebarPaneHeader must be used within a Sidebar');
  }

  const floating = sidebarContext.floating;
  const isFloating = floating?.isFloating;

  return (
    <div className={cx(styles.wrapper, isFloating && styles.floatingWrapper)}>
      <div className={styles.header}>
        {isFloating && (
          <IconButton
            name="draggabledots"
            className={styles.drag}
            aria-label={t('grafana-ui.sidebar.move', 'Move toolbox')}
            {...floating.dragProps}
          />
        )}
        {sidebarContext.onGoBack && (!isFloating || sidebarContext.canGoBack) && (
          <IconButton
            variant="secondary"
            size="lg"
            name="arrow-left"
            onClick={sidebarContext.onGoBack}
            disabled={!sidebarContext.canGoBack}
            aria-label={t('grafana-ui.sidebar.go-back', 'Go back')}
            tooltip={t('grafana-ui.sidebar.go-back', 'Go back')}
            data-testid={selectors.components.Sidebar.goBack}
          />
        )}
        {isFloating ? (
          <button
            type="button"
            className={styles.dragTitle}
            aria-label={t('grafana-ui.sidebar.move-title', 'Move {{title}} toolbox', { title })}
            {...floating.dragProps}
          >
            <Text weight="medium" variant="h6" truncate data-testid={selectors.components.Sidebar.headerTitle}>
              {title}
            </Text>
          </button>
        ) : (
          <Text weight="medium" variant="h6" truncate data-testid={selectors.components.Sidebar.headerTitle}>
            {title}
          </Text>
        )}
        <div className={styles.flexGrow} />
        {isFloating && children && <div className={styles.quickActions}>{children}</div>}
        {isFloating && (
          <>
            {sidebarContext.hasOpenPane && (
              <IconButton
                name={floating.isMinimized ? 'angle-down' : 'angle-up'}
                onClick={floating.toggleMinimized}
                tooltip={
                  floating.isMinimized
                    ? t('grafana-ui.sidebar.expand', 'Expand toolbox')
                    : t('grafana-ui.sidebar.minimize', 'Minimize toolbox')
                }
              />
            )}
            <IconButton
              name="angle-double-up"
              onClick={floating.park}
              tooltip={t('grafana-ui.sidebar.park', 'Move away from panels')}
            />
          </>
        )}
        {floating && (
          <IconButton
            name="expand-arrows"
            onClick={floating.toggle}
            tooltip={
              isFloating
                ? t('grafana-ui.sidebar.return', 'Return to sidebar')
                : t('grafana-ui.sidebar.float', 'Float toolbox')
            }
          />
        )}
        {!isFloating && sidebarContext.onToggleDock && (
          <IconButton
            name={'web-section-alt'}
            onClick={sidebarContext.onToggleDock}
            className={sidebarContext.isDocked ? undefined : styles.dockedButtonUndocked}
            tooltip={
              sidebarContext.isDocked ? t('grafana-ui.sidebar.undock', 'Undock') : t('grafana-ui.sidebar.dock', 'Dock')
            }
            data-testid={selectors.components.Sidebar.dockToggle}
          />
        )}
        {sidebarContext.onClosePane && (!isFloating || sidebarContext.hasOpenPane) && (
          <IconButton
            variant="secondary"
            size="lg"
            name="times"
            onClick={sidebarContext.onClosePane}
            aria-label={t('grafana-ui.sidebar.close', 'Close')}
            tooltip={t('grafana-ui.sidebar.close', 'Close')}
            data-testid={selectors.components.Sidebar.closePane}
          />
        )}
      </div>
      {!isFloating && children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    dragTitle: css({
      cursor: 'move',
      touchAction: 'none',
      background: 'transparent',
      border: 0,
      color: 'inherit',
      textAlign: 'left',
      minWidth: 0,
      flex: '1 1 auto',
      padding: 0,
    }),
    drag: css({ cursor: 'move', touchAction: 'none', flexShrink: 0 }),
    floatingWrapper: css({
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      background: theme.colors.background.primary,
      zIndex: 1,
      '> div': { height: 46, padding: theme.spacing(0.5), gap: theme.spacing(0.5) },
      '[data-testid]': { minWidth: 0 },
      [`[data-testid="${selectors.components.Sidebar.headerTitle}"]`]: { flex: '1 1 auto' },
      '@container sidebar-toolbox (max-height: 48px)': {
        '& ~ *': { display: 'none' },
      },
    }),
    quickActions: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      flexShrink: 0,
      button: { padding: theme.spacing(0.5), gap: 0, minWidth: 24 },
      'button:has(svg)': { fontSize: 0 },
      'button svg': { margin: 0 },
      '@container sidebar-toolbox (min-width: 640px)': {
        'button:has(svg)': { fontSize: theme.typography.bodySmall.fontSize, gap: theme.spacing(0.5) },
      },
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(1.5, 1, 1.5, 1.5),
      gap: theme.spacing(1),
    }),
    flexGrow: css({
      flexGrow: 1,
    }),
    actions: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0, 1, 1.5, 1),
      '&:empty': {
        display: 'none',
      },
    }),
    dockedButtonUndocked: css({
      opacity: 0.6,
    }),
  };
};
