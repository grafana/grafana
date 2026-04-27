import { css, cx } from '@emotion/css';
import { type ActionId, type ActionImpl } from 'kbar';
import * as React from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Badge } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { ManagerKind } from 'app/features/apiserver/types';

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

    // type assertion needed because kbar's ActionImpl copies all properties from the input Action object at runtime,
    // but its TS type doesn't reflect custom properties like managedBy or url.
    // See the same pattern for `url` in KBarResults.tsx and below command url
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const managedBy = (action as ActionImpl & { managedBy?: ManagerKind }).managedBy;
    const showProvisionedBadge = config.featureToggles.provisioning && managedBy === ManagerKind.Repo;

    let name = action.name;

    const hasCommandOrLink = (action: ActionImpl) =>
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      Boolean(action.command?.perform || (action as ActionImpl & { url?: string }).url);

    // TODO: does this needs adjusting for i18n?
    if (action.children.length && !hasCommandOrLink(action) && !name.endsWith('...')) {
      name += '...';
    }

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
          {action.subtitle && <span className={styles.subtitleText}>{action.subtitle}</span>}
          {showProvisionedBadge && (
            <Badge
              color="purple"
              icon="exchange-alt"
              aria-label={t('command-palette.badge.provisioned', 'Provisioned')}
              tooltip={t('command-palette.badge.provisioned', 'Provisioned')}
            />
          )}
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
      borderRadius: theme.shape.radius.default,
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
        borderRadius: theme.shape.radius.default,
        backgroundImage: theme.colors.gradients.brandVertical,
      },
    }),
    actionContainer: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'baseline',
      fontSize: theme.typography.fontSize,
      width: '100%',
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
      display: 'block',
      flexBasis: '20%',
      flexGrow: 1,
      flexShrink: 0,
      maxWidth: 'fit-content',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  };
};
