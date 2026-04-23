import { css } from '@emotion/css';
import { useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';
import { type Rule, type RuleGroupIdentifierV2 } from 'app/types/unified-alerting';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { type ChainInfo } from '../lib/types';

import { DependencyOverlay } from './DependencyOverlay';
import { RuleCard } from './RuleCard';

interface Props {
  rules: Rule[];
  chain: ChainInfo;
  groupIdentifier: RuleGroupIdentifierV2;
}

export function ChainView({ rules, chain, groupIdentifier }: Props) {
  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const recordingRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const alertRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const recordings = rules.filter((r) => r.type === PromRuleType.Recording);
  const alerts = rules.filter((r) => r.type === PromRuleType.Alerting);

  const description = describeChain(chain);

  return (
    <div ref={containerRef} className={styles.grid}>
      <div className={styles.column}>
        <div className={styles.colHeader}>
          <Icon name="record-audio" />
          <span>
            <Trans i18nKey="alerting.rule-list-v2.chain.recordings-first">RECORDING RULES EVALUATE FIRST</Trans>
          </span>
        </div>
        {recordings.map((rule) => (
          <div
            key={rule.name}
            ref={(el) => {
              recordingRefs.current.set(rule.name, el);
            }}
          >
            <RuleCard
              rule={rule}
              instanceCount={undefined}
              contactPoint={undefined}
              showStateChip={false}
              groupIdentifier={groupIdentifier}
            />
          </div>
        ))}
      </div>

      <div className={styles.middle} aria-hidden="true" />

      <div className={styles.column}>
        <div className={styles.colHeaderAlert}>
          <Icon name="bell" />
          <span>
            <Trans i18nKey="alerting.rule-list-v2.chain.alerts-after">THEN ALERT RULES FIRE ON THEM</Trans>
          </span>
        </div>
        {alerts.map((rule) => (
          <div
            key={rule.name}
            ref={(el) => {
              alertRefs.current.set(rule.name, el);
            }}
          >
            <RuleCard
              rule={rule}
              instanceCount={countInstances(rule)}
              contactPoint={undefined}
              groupIdentifier={groupIdentifier}
            />
          </div>
        ))}
      </div>

      <DependencyOverlay
        containerRef={containerRef}
        recordingRefs={recordingRefs}
        alertRefs={alertRefs}
        dependencies={chain.dependencies}
        description={description}
      />

      <span className={styles.visuallyHidden}>{description}</span>
    </div>
  );
}

function describeChain(chain: ChainInfo): string {
  if (chain.dependencies.size === 0) {
    return t(
      'alerting.rule-list-v2.chain.description-empty',
      'No dependencies between recording and alert rules in this group.'
    );
  }
  const parts: string[] = [];
  chain.dependencies.forEach((recordings, alertName) => {
    parts.push(
      t('alerting.rule-list-v2.chain.description-item', '{{alert}} depends on {{recordings}}', {
        alert: alertName,
        recordings: recordings.join(', '),
      })
    );
  });
  return parts.join('. ');
}

function countInstances(rule: Rule): number | undefined {
  if (rule.type !== PromRuleType.Alerting) {
    return undefined;
  }
  return rule.alerts?.length ?? 0;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    grid: css({
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '1fr 80px 1fr',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
    }),
    column: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    colHeader: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      color: theme.colors.info.text,
      textTransform: 'uppercase',
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightBold,
      letterSpacing: '0.05em',
      marginBottom: theme.spacing(0.5),
    }),
    colHeaderAlert: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      color: theme.colors.warning.text,
      textTransform: 'uppercase',
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightBold,
      letterSpacing: '0.05em',
      marginBottom: theme.spacing(0.5),
    }),
    middle: css({
      position: 'relative',
    }),
    visuallyHidden: css({
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0,
    }),
  };
}
