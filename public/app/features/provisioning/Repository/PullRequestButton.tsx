import { Trans } from '@grafana/i18n';
import { LinkButton } from '@grafana/ui';

interface Props {
  jobType?: 'sync' | 'delete' | 'move';
  pullRequestURL?: string;
}
export function PullRequestButton({ pullRequestURL, jobType }: Props) {
  if (!pullRequestURL || jobType === 'sync') {
    return null;
  }

  return (
    <LinkButton href={pullRequestURL} icon="external-link-alt" variant="secondary" target="_blank">
      <Trans i18nKey="provisioning.repository-link.delete-or-move-job.open-pull-request">Open pull request</Trans>
    </LinkButton>
  );
}
