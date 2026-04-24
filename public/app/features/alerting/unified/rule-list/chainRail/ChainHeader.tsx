import { Trans, t } from '@grafana/i18n';
import { Button, Icon, useStyles2 } from '@grafana/ui';

import { getChainRailStyles } from './styles';
import { type Chain } from './types';

interface ChainHeaderProps {
  chain: Chain;
  ruleCount: number;
  onEdit?: () => void;
  onMore?: () => void;
}

export function ChainHeader({ chain, ruleCount, onEdit, onMore }: ChainHeaderProps) {
  const styles = useStyles2(getChainRailStyles);

  return (
    <div role="heading" aria-level={4} className={styles.chainHeader}>
      <span className={styles.chainHeaderIcon} aria-hidden="true">
        <Icon name="link" size="sm" />
      </span>
      <span className={styles.chainHeaderName}>{chain.name}</span>
      <span className={styles.chainHeaderCount}>
        {t('alerting.chain-rail.rule-count', '{{count}} rules', { count: ruleCount })}
      </span>
      <span className={styles.chainHeaderSpacer} />
      <span className={styles.chainHeaderMeta}>
        <span>
          {chain.mode} · {chain.interval}
        </span>
      </span>
      <div className={styles.chainHeaderActions}>
        <Button
          size="sm"
          variant="secondary"
          fill="text"
          aria-label={t('alerting.chain-rail.edit-aria', 'Edit {{name}}', { name: chain.name })}
          onClick={onEdit}
        >
          <Trans i18nKey="alerting.chain-rail.edit">Edit</Trans>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          fill="text"
          aria-label={t('alerting.chain-rail.more-aria', 'More options for {{name}}', { name: chain.name })}
          onClick={onMore}
        >
          <Trans i18nKey="alerting.chain-rail.more">More</Trans>
        </Button>
      </div>
    </div>
  );
}
