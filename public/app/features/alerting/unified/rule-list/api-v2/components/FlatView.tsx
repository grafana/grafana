import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { type Rule, type RuleGroupIdentifierV2 } from 'app/types/unified-alerting';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { RuleCard } from './RuleCard';

interface Props {
  rules: Rule[];
  groupIdentifier: RuleGroupIdentifierV2;
}

export function FlatView({ rules, groupIdentifier }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.list}>
      {rules.map((rule, idx) => (
        <RuleCard
          key={rule.name}
          rule={rule}
          index={idx}
          instanceCount={instanceCount(rule)}
          groupIdentifier={groupIdentifier}
        />
      ))}
    </div>
  );
}

function instanceCount(rule: Rule): number | undefined {
  if (rule.type !== PromRuleType.Alerting) {
    return undefined;
  }
  return rule.alerts?.length ?? 0;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      padding: theme.spacing(1),
    }),
  };
}
