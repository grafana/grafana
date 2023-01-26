import { css, cx } from '@emotion/css';
import { ActionId, ActionImpl } from 'kbar';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

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

    const styles = useStyles2(getResultItemStyles);

    let name = action.name;

    // TODO: does this needs adjusting for i18n?
    if (action.children && !action.command?.perform && !name.endsWith('...')) {
      name += '...';
    }

    return (
      <div ref={ref} className={cx(styles.row, active && styles.activeRow)}>
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
              <span>{name}</span>
            </div>
          </div>
          {action.subtitle && <span className={styles.subtitleText}>{action.subtitle}</span>}
        </div>
      </div>
    );
  }
);

ResultItem.displayName = 'ResultItem';

const getResultItemStyles = (theme: GrafanaTheme2) => {
  return {
    row: css({
      padding: theme.spacing(1, 2),
      display: 'flex',
      alightItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      position: 'relative',
      borderRadius: theme.shape.borderRadius(2),
      margin: theme.spacing(0, 1),
    }),
    activeRow: css({
      color: theme.colors.text.maxContrast,
      background: theme.colors.emphasize(theme.colors.background.primary, 0.03),
      '&:before': {
        display: 'block',
        content: '" "',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: theme.spacing(0.5),
        borderRadius: theme.shape.borderRadius(2),
        backgroundImage: theme.colors.gradients.brandVertical,
      },
    }),
    actionContainer: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
      fontSize: theme.typography.fontSize,
    }),
    textContainer: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    shortcut: css({
      padding: theme.spacing(0, 1),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.borderRadius(),
      fontSize: theme.typography.fontSize,
    }),
    breadcrumbAncestor: css({
      marginRight: theme.spacing(1),
      color: theme.colors.text.secondary,
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
