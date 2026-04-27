import { css } from '@emotion/css';
import { PropsWithChildren } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2 } from '@grafana/ui';

interface RuleGroupContainerProps extends PropsWithChildren {
  groupName: string;
}

export function RuleGroupContainer({ groupName, children }: RuleGroupContainerProps) {
  const styles = useStyles2(getStyles);

  return (
    <li className={styles.container} role="treeitem" aria-selected="false">
      <div className={styles.groupLabel}>
        <Text variant="bodySmall" color="secondary">
          {groupName}
        </Text>
      </div>
      <ul role="group" className={styles.rulesList}>
        {children}
      </ul>
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'relative',
    listStyle: 'none',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(1),
    paddingLeft: theme.spacing(1),
    borderLeft: `1px solid ${theme.colors.border.weak}`,
    borderTop: `1px solid ${theme.colors.border.weak}`,
    borderTopLeftRadius: theme.shape.radius.default,

    // Override the tree line from parent - groups shouldn't have the vertical line
    '&:before': {
      display: 'none',
    },

    // Remove margin from last item
    '&:last-child': {
      marginBottom: 0,
    },
  }),
  groupLabel: css({
    position: 'absolute',
    top: theme.spacing(-1.5),
    right: 0,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  rulesList: css({
    listStyle: 'none',
    padding: 0,
    margin: 0,
  }),
});
