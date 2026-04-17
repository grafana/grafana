import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Badge } from '@grafana/ui';

interface EvaluationChainBadgeProps {
  chainName: string;
  chainUid: string;
}

export function EvaluationChainBadge({ chainName, chainUid }: EvaluationChainBadgeProps) {
  const handleClick = () => {
    locationService.push(`/alerting/list?tab=evaluation-chains&chain=${chainUid}`);
  };

  return (
    <Badge
      text={chainName}
      icon="link"
      color="orange"
      tooltip={t('alerting.evaluation-chain-badge.tooltip', 'Part of evaluation chain: {{chainName}}', { chainName })}
      onClick={handleClick}
    />
  );
}
