import { t } from '@grafana/i18n';
import { Button, LinkButton } from '@grafana/ui';

import { type ProvisionedCommitOutcome, isDirectCommit } from './provisionedCommitOutcome';

interface Props {
  outcome: ProvisionedCommitOutcome;
  onDismiss: () => void;
}

export function ProvisionedCommitSteps({ outcome, onDismiss }: Props) {
  const externalUrl = outcome.prUrl || (isDirectCommit(outcome) ? undefined : outcome.repoUrl);

  if (!externalUrl) {
    return (
      <Button variant="secondary" onClick={onDismiss}>
        {t('provisioning.commit-steps.close', 'Close')}
      </Button>
    );
  }
  return (
    <LinkButton href={externalUrl} target="_blank" variant="primary" icon="external-link-alt">
      {outcome.prUrl
        ? t('provisioning.commit-steps.open-pull-request', 'Open pull request')
        : t('provisioning.commit-steps.open-repository', 'Open repository')}
    </LinkButton>
  );
}
