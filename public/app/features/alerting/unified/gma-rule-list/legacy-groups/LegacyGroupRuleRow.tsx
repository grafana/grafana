import { useId } from 'react';

import { t } from '@grafana/i18n';
import { Icon, Stack, Text, TextLink } from '@grafana/ui';
import { type GrafanaPromRuleDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { grafanaRulesNav } from '../../utils/navigation';
import { RuleInterval } from '../rule-row/RuleInterval';
import { RuleLabels } from '../rule-row/RuleLabels';
import { RuleListItem } from '../rule-row/RuleListItem';
import { OriginBadge } from '../rule-row/RuleOriginBadge';

interface LegacyGroupRuleRowProps {
  rule: GrafanaPromRuleDTO;
  interval: string;
  /** Why the rule stays in the group. */
  note?: string;
}

export function LegacyGroupRuleRow({ rule, interval, note }: LegacyGroupRuleRowProps) {
  const titleId = useId();

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<Icon name={rule.type === PromRuleType.Recording ? 'record-audio' : 'bell'} />}
      title={
        <Stack direction="row" alignItems="center" gap={0.5} wrap={false}>
          <TextLink id={titleId} href={grafanaRulesNav.viewLink(rule.uid)} color="primary" inline={false}>
            {rule.name}
          </TextLink>
          <OriginBadge labels={rule.labels} provenance={rule.provenance} />
        </Stack>
      }
      description={
        note && (
          <Text variant="bodySmall" color="warning">
            {note}
          </Text>
        )
      }
      right={<RuleInterval interval={interval} />}
      meta={[
        rule.type === PromRuleType.Recording && (
          <Text key="kind" variant="bodySmall" color="secondary">
            {t('alerting.gma-rule-list.legacy-groups.recording-rule', 'Recording rule')}
          </Text>
        ),
        rule.labels && <RuleLabels key="labels" labels={rule.labels} />,
      ]}
    />
  );
}
