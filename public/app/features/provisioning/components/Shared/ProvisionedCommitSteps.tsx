import { useNavigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { Button, LinkButton } from '@grafana/ui';

import { type ResourceKindInfo, type ResourceKindKey, resourceKindInfos } from '../../utils/resourceKinds';

import { type ProvisionedCommitOutcome, isDirectCommit } from './provisionedCommitOutcome';

interface Props {
  kindKey?: ResourceKindKey;
  outcome: ProvisionedCommitOutcome;
  resourceName?: string;
  onDismiss: () => void;
}

export function ProvisionedCommitSteps({ kindKey, outcome, resourceName, onDismiss }: Props) {
  const navigate = useNavigate();
  const kind: ResourceKindInfo | undefined = kindKey && resourceKindInfos[kindKey];
  const isDirect = isDirectCommit(outcome);
  const externalUrl = outcome.prUrl || (isDirect ? undefined : outcome.repoUrl);
  const canView = isDirect && !outcome.pendingSync && outcome.action !== 'delete';
  const viewUrl = canView && resourceName ? kind?.getRoute?.(resourceName) : undefined;

  return (
    <>
      {externalUrl && (
        <LinkButton href={externalUrl} target="_blank" variant="primary" icon="external-link-alt">
          {outcome.prUrl
            ? t('provisioning.commit-steps.open-pull-request', 'Open pull request')
            : t('provisioning.commit-steps.open-repository', 'Open repository')}
        </LinkButton>
      )}
      {viewUrl && kind && (
        <Button
          variant="secondary"
          onClick={() => {
            onDismiss();
            navigate(viewUrl);
          }}
        >
          {t('provisioning.commit-steps.view', 'View {{resource}}', {
            resource: kind.getLabel({ upperFirst: false }),
          })}
        </Button>
      )}
      {!externalUrl && !viewUrl && (
        <Button variant="secondary" onClick={onDismiss}>
          {t('provisioning.commit-steps.close', 'Close')}
        </Button>
      )}
    </>
  );
}
