import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';
import { type RuleGroup, type RuleGroupIdentifierV2 } from 'app/types/unified-alerting';

import { type ChainInfo } from '../lib/types';

import { ChainView } from './ChainView';
import { FlatView } from './FlatView';

interface Props {
  group: RuleGroup;
  groupIdentifier: RuleGroupIdentifierV2;
  chain: ChainInfo;
  showArrows: boolean;
}

/**
 * Outer card for an evaluation chain. Unlike the legacy `EvaluationGroupPanel`,
 * this card has no group-name header, no interval chip, and no Edit-group / ⋮
 * actions — rules don't have groups anymore in the new rules API (only virtual
 * groups for chain evaluation). The card only exists to visually bind
 * recording rules with the alerts that feed on them.
 */
export function EvaluationChainCard({ group, groupIdentifier, chain, showArrows }: Props) {
  const styles = useStyles2(getStyles);
  const useChain = chain.isChain && showArrows;

  return (
    <section className={styles.panel}>
      <div className={styles.badgeRow}>
        <span className={styles.chainBadge}>
          <Icon name="link" size="sm" />
          <Trans i18nKey="alerting.rule-list-v2.evaluation-chain-badge">evaluation chain</Trans>
        </span>
      </div>
      <div className={styles.body}>
        {useChain ? (
          <ChainView rules={group.rules} chain={chain} groupIdentifier={groupIdentifier} />
        ) : (
          <FlatView rules={group.rules} groupIdentifier={groupIdentifier} />
        )}
      </div>
    </section>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    panel: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
      overflow: 'hidden',
    }),
    badgeRow: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(1, 1, 0, 1),
    }),
    chainBadge: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.25, 0.75),
      borderRadius: theme.shape.radius.pill,
      background: 'rgba(240, 90, 40, 0.1)',
      border: `1px solid ${theme.colors.warning.border}`,
      color: theme.colors.warning.text,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    body: css({}),
  };
}
