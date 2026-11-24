import { t } from '@grafana/i18n';
import { Button, LinkButton } from '@grafana/ui';

import { type ProvisionedCommitOutcome, isDirectCommit } from './provisionedCommitOutcome';

interface Props {
  outcome: ProvisionedCommitOutcome;
  onDismiss: () => void;
  onBack?: () => void;
  backLabel?: string;
}

export function ProvisionedCommitSteps({ outcome, onDismiss, onBack, backLabel }: Props) {
  const externalUrl = outcome.prUrl || (isDirectCommit(outcome) ? undefined : outcome.repoUrl);

  return (
    <>
      {externalUrl && (
        <LinkButton href={externalUrl} target="_blank" variant="primary" icon="external-link-alt">
          {outcome.prUrl
            ? t('provisioning.commit-steps.open-pull-request', 'Open pull request')
            : t('provisioning.commit-steps.open-repository', 'Open repository')}
        </LinkButton>
      )}
      {onBack && (
        <Button variant="secondary" onClick={onBack}>
          {backLabel
            ? t('provisioning.commit-steps.back-to-list', 'Back to all {{resources}}', { resources: backLabel })
            : t('provisioning.commit-steps.back', 'Back')}
        </Button>
      )}
      {!externalUrl && !onBack && (
        <Button variant="secondary" onClick={onDismiss}>
          {t('provisioning.commit-steps.close', 'Close')}
        </Button>
      )}
    </>
  );
}
