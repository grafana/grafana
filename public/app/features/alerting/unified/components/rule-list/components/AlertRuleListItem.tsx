import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

interface AlertRuleListItemProps {
  title: ReactNode;
  description?: ReactNode;
  error?: string;
  state?: PromAlertingRuleState;
  meta?: ReactNode;
  metaRight?: ReactNode;
  actions?: ReactNode;
}

export const AlertRuleListItem = (props: AlertRuleListItemProps) => {
  const { title, description = null, state, error, meta = null, metaRight = null, actions = null } = props;
  const styles = useStyles2(getStyles);

  const icons: Record<PromAlertingRuleState, IconName> = {
    [PromAlertingRuleState.Inactive]: 'check',
    [PromAlertingRuleState.Pending]: 'hourglass',
    [PromAlertingRuleState.Firing]: 'exclamation-circle',
  };

  const color: Record<PromAlertingRuleState, 'success' | 'error' | 'warning'> = {
    [PromAlertingRuleState.Inactive]: 'success',
    [PromAlertingRuleState.Pending]: 'warning',
    [PromAlertingRuleState.Firing]: 'error',
  };

  return (
    <li className={styles.alertListItemContainer} role="treeitem" aria-selected="false">
      <Stack direction="row" alignItems="start" gap={1} wrap={false}>
        {/* state */}
        <Text color={state ? color[state] : 'secondary'}>
          <Icon name={state ? icons[state] : 'circle'} size="lg" />
        </Text>

        <Stack direction="column" gap={0} flex="1" minWidth={0}>
          {/* title */}
          <Stack direction="column" gap={0}>
            <div className={styles.textOverflow}>{title}</div>
            <div className={styles.textOverflow}>{description}</div>
          </Stack>
          {/* metadata */}
          {error ? (
            <Text truncate color="error" variant="bodySmall">
              {error}
            </Text>
          ) : (
            <Stack direction="row" gap={1}>
              {meta}
            </Stack>
          )}
        </Stack>

        {/* actions */}
        <Stack direction="row" alignItems="center" gap={1} wrap={false}>
          {metaRight}
          {actions}
        </Stack>
      </Stack>
    </li>
  );
};

interface RuleLocationProps {
  namespace: CombinedRuleNamespace;
  group: string;
}

export const RuleLocation = ({ namespace, group }: RuleLocationProps) => (
  <Stack direction="row" alignItems="center" gap={0.5}>
    <Icon size="xs" name="folder" />
    <Stack direction="row" alignItems="center" gap={0}>
      {namespace.name}
      <Icon size="sm" name="angle-right" />
      {group}
    </Stack>
  </Stack>
);

const getStyles = (theme: GrafanaTheme2) => ({
  alertListItemContainer: css({
    position: 'relative',
    listStyle: 'none',
    background: theme.colors.background.primary,

    borderBottom: `solid 1px ${theme.colors.border.weak}`,
    padding: `${theme.spacing(1)} ${theme.spacing(1)}`,
  }),
  textOverflow: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
});
