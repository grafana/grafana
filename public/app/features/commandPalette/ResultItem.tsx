import { css } from '@emotion/css';
import { ActionId, ActionImpl } from 'kbar';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

export const ResultItem = React.forwardRef(
  (
    {
      action,
      active,
      currentRootActionId,
    }: {
      action: ActionImpl;
      active: boolean;
      currentRootActionId: ActionId;
    },
    ref: React.Ref<HTMLDivElement>
  ) => {
    const ancestors = React.useMemo(() => {
      if (!currentRootActionId) {
        return action.ancestors;
      }

      const index = action.ancestors.findIndex((ancestor) => ancestor.id === currentRootActionId);
      // +1 removes the currentRootAction; e.g.
      // if we are on the "Set theme" parent action,
      // the UI should not display "Set theme… > Dark"
      // but rather just "Dark"
      return action.ancestors.slice(index + 1);
    }, [action.ancestors, currentRootActionId]);

    const theme = useTheme2();
    const styles = getResultItemStyles(theme, active);

    return (
      <div ref={ref} className={styles.row}>
        <div className={styles.actionContainer}>
          {action.icon}
          <div className={styles.textContainer}>
            <div>
              {ancestors.length > 0 &&
                ancestors.map((ancestor) => (
                  <React.Fragment key={ancestor.id}>
                    <span className={styles.breadcrumbAncestor}>{ancestor.name}</span>
                    <span className={styles.breadcrumbAncestor}>&rsaquo;</span>
                  </React.Fragment>
                ))}
              <span>{action.name}</span>
            </div>
          </div>
          {action.subtitle && <span className={styles.subtitleText}>{action.subtitle}</span>}
        </div>
        {action.shortcut?.length ? (
          <div aria-hidden className={styles.shortcutContainer}>
            {action.shortcut.map((sc) => (
              <kbd key={sc} className={styles.shortcut}>
                {sc}
              </kbd>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
);
ResultItem.displayName = 'ResultItem';

const getResultItemStyles = (theme: GrafanaTheme2, isActive: boolean) => {
  const textColor = isActive ? theme.colors.text.maxContrast : theme.colors.text.primary;
  const rowBackgroundColor = isActive ? theme.colors.background.primary : 'transparent';
  const shortcutBackgroundColor = isActive ? theme.colors.background.secondary : theme.colors.background.primary;
  return {
    row: css({
      color: textColor,
      padding: theme.spacing(1, 2),
      background: rowBackgroundColor,
      display: 'flex',
      alightItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      '&:before': {
        display: isActive ? 'block' : 'none',
        content: '" "',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: theme.spacing(0.5),
        borderRadius: theme.shape.borderRadius(1),
        backgroundImage: theme.colors.gradients.brandVertical,
      },
    }),
    actionContainer: css({
      display: 'flex',
      gap: theme.spacing(2),
      alignitems: 'center',
      fontsize: theme.typography.fontSize,
    }),
    textContainer: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    shortcut: css({
      padding: theme.spacing(0, 1),
      background: shortcutBackgroundColor,
      borderRadius: theme.shape.borderRadius(),
      fontsize: theme.typography.fontSize,
    }),
    breadcrumbAncestor: css({
      opacity: 0.5,
      marginRight: theme.spacing(1),
    }),
    subtitleText: css({
      fontSize: theme.typography.fontSize - 2,
    }),
    shortcutContainer: css({
      display: 'grid',
      gridAutoFlow: 'column',
      gap: theme.spacing(1),
    }),
  };
};
