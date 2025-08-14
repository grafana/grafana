import { Trans } from '@grafana/i18n';
import { LinkButton } from '@grafana/ui';
import { RepositoryUrLs } from 'app/api/clients/provisioning/v0alpha1';

interface Props {
  jobType?: 'sync' | 'delete' | 'move';
  urls?: RepositoryUrLs;
}
export function PullRequestButtons({ urls, jobType }: Props) {
  const pullRequestURL = urls?.newPullRequestURL;
  const compareURL = urls?.compareURL;
  const branchURL = urls?.sourceURL;

  if (jobType === 'sync') {
    return null;
  }

  return (
    <>
      <LinkButton href={branchURL} icon="external-link-alt" variant="secondary" target="_blank">
        <Trans i18nKey="provisioning.repository-link.delete-or-move-job.view-branch">View branch</Trans>
      </LinkButton>
      <LinkButton href={compareURL} icon="external-link-alt" variant="secondary" target="_blank">
        <Trans i18nKey="provisioning.repository-link.delete-or-move-job.compare-branch">Compare branch</Trans>
      </LinkButton>
      <LinkButton href={pullRequestURL} icon="external-link-alt" variant="secondary" target="_blank">
        <Trans i18nKey="provisioning.repository-link.delete-or-move-job.open-pull-request">Open pull request</Trans>
      </LinkButton>
    </>
  );
}
