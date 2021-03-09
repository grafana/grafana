import { useStyles } from '@grafana/ui';
import { RuleNamespace } from 'app/types/unified-alerting/internal';
import React, { FC, useMemo, useState } from 'react';
import pluralize from 'pluralize';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { RuleCollapse } from './RuleCollapse';
import { RulesGroup } from './RulesGroup';

interface Props {
  namespace: RuleNamespace;
}

export const RulesNamespace: FC<Props> = ({ namespace }) => {
  const styles = useStyles(getStyles);

  const [isOpen, setIsOpen] = useState(false);

  const stats = useMemo(
    () => ({
      groupCount: namespace.groups.length,
      ruleCount: namespace.groups.reduce((count, group) => group.rules.length + count, 0),
    }),
    [namespace]
  );

  const labelLeft = <strong>{namespace.name}</strong>;
  const labelRight = (
    <span className={styles.stats}>
      {stats.groupCount} {pluralize('group', stats.groupCount)}, {stats.ruleCount} {pluralize('rule', stats.ruleCount)}{' '}
      total
    </span>
  );
  return (
    <RuleCollapse
      collapsible={true}
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      labelLeft={labelLeft}
      labelRight={labelRight}
    >
      <div className={styles.content}>
        {namespace.groups.map((group) => (
          <RulesGroup key={group.name} group={group} />
        ))}
      </div>
    </RuleCollapse>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  content: css`
    & > div + div {
      margin-top: ${theme.spacing.md};
    }
  `,
  stats: css`
    font-weight: ${theme.typography.weight.regular};
  `,
});
