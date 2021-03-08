import { Collapse, useStyles } from '@grafana/ui';
import { RuleNamespace } from 'app/types/unified-alerting/internal';
import React, { FC, useMemo, useState } from 'react';
import pluralize from 'pluralize';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

interface Props {
  namespace: RuleNamespace;
}

export const Namespace: FC<Props> = ({ namespace }) => {
  const styles = useStyles(getStyles);

  const [isOpen, setIsOpen] = useState(false);

  const stats = useMemo(
    () => ({
      groupCount: namespace.groups.length,
      ruleCount: namespace.groups.reduce((count, group) => group.rules.length + count, 0),
    }),
    [namespace]
  );

  const title: React.ReactNode = (
    <div className={styles.title}>
      <strong>{namespace.name}</strong>
      <span className={styles.stats}>
        {stats.groupCount} {pluralize('group', stats.groupCount)}, {stats.ruleCount}{' '}
        {pluralize('rule', stats.ruleCount)} total
      </span>
    </div>
  );
  return (
    <Collapse
      className={styles.collapse}
      collapsible={true}
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      label={title}
    >
      <p>@TODO</p>
    </Collapse>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  collapse: css`
    background-color: ${theme.colors.bg2};
    & > div > div + div {
      flex: 1;
    }
  `,
  title: css`
    display: flex;
    justify-content: space-between;
  `,
  stats: css`
    font-weight: ${theme.typography.weight.regular};
  `,
});
