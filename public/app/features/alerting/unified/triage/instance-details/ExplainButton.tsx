import { Trans, t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

interface ExplainButtonProps {
  onClick: () => void;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'secondary';
}

export function ExplainButton({ onClick, size = 'sm', variant = 'secondary' }: ExplainButtonProps) {
  return (
    <Button
      icon="search-plus"
      variant={variant}
      size={size}
      onClick={onClick}
      aria-label={t('alerting.triage.explain.button', 'Explain')}
    >
      <Trans i18nKey="alerting.triage.explain.button">Explain</Trans>
    </Button>
  );
}
