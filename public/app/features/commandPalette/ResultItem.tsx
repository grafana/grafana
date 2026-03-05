import { css, cx } from '@emotion/css';
import { ActionId, ActionImpl, useKBar } from 'kbar';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

interface ActionWithSecondaryActions extends ActionImpl {
  secondaryActions?: React.ReactNode;
}

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

    const { query } = useKBar();
    const styles = useStyles2(getResultItemStyles);

    const name = action.name;

    const hasCommandOrLink = (action: ActionImpl) =>
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      Boolean(action.command?.perform || (action as ActionImpl & { url?: string }).url);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const secondaryActions = (action as ActionWithSecondaryActions).secondaryActions;

    return (
      <div ref={ref} className={cx(styles.row, active && styles.activeRow)}>
        <div className={styles.actionContainer}>
          {action.icon}
          <div className={styles.textContainer}>
            {ancestors.map((ancestor) => (
              <React.Fragment key={ancestor.id}>
                {!hasCommandOrLink(ancestor) && (
                  <>
                    <span className={styles.breadcrumbAncestor}>{ancestor.name}</span>
                    <span className={styles.breadcrumbSeparator}>&rsaquo;</span>
                  </>
                )}
              </React.Fragment>
            ))}
            <span>{name}</span>
          </div>
          {action.subtitle && (
            <span className={styles.subtitleText}>
              {isLocationSubtitle(action.id) && (
                <Icon name="folder" size="sm" className={styles.subtitleIcon} />
              )}
              {action.subtitle}
            </span>
          )}
        </div>
        {secondaryActions && (
          <div
            data-secondary-actions
            className={cx(styles.secondaryActionsContainer, active && styles.secondaryActionsVisible)}
            onClickCapture={() => {
              setTimeout(() => query.toggle(), 0);
            }}
          >
            {secondaryActions}
          </div>
        )}
        {active && action.children.length > 0 && (
          <Icon name="angle-right" className={styles.arrowIcon} />
        )}
      </div>
    );
  }
);

ResultItem.displayName = 'ResultItem';

function isLocationSubtitle(actionId: string): boolean {
  return actionId.startsWith('recent-dashboards') || actionId.startsWith('go/');
}

const getResultItemStyles = (theme: GrafanaTheme2) => {
  return {
    row: css({
      padding: theme.spacing(1, 2),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      position: 'relative',
      borderRadius: theme.shape.radius.default,
      margin: theme.spacing(0, 1),
    }),
    activeRow: css({
      color: theme.colors.text.maxContrast,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.action.selected,
    }),
    actionContainer: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
      fontSize: theme.typography.fontSize,
      width: '100%',
      '& > svg': {
        color: theme.colors.text.secondary,
      },
    }),
    textContainer: css({
      display: 'block',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    breadcrumbAncestor: css({
      color: theme.colors.text.secondary,
    }),
    breadcrumbSeparator: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(1),
      marginRight: theme.spacing(1),
    }),
    subtitleText: css({
      ...theme.typography.bodySmall,
      color: theme.colors.text.secondary,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      flexBasis: '20%',
      flexGrow: 1,
      flexShrink: 0,
      maxWidth: 'fit-content',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    subtitleIcon: css({
      color: theme.colors.text.disabled,
      flexShrink: 0,
    }),
    secondaryActionsContainer: css({
      display: 'none',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      flexShrink: 0,
    }),
    secondaryActionsVisible: css({
      display: 'flex',
    }),
    arrowIcon: css({
      color: theme.colors.text.secondary,
      marginLeft: 'auto',
      flexShrink: 0,
      alignSelf: 'center',
    }),
  };
};
