import { textUtil } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { LinkButton, Stack } from '@grafana/ui';
import { type RepositoryUrLs } from 'app/api/clients/provisioning/v0alpha1';

import { type JobType } from '../types';

interface Props {
  jobType?: JobType;
  urls?: RepositoryUrLs;
}
export function PullRequestButtons({ urls, jobType }: Props) {
  const pullRequestURL = urls?.newPullRequestURL ? textUtil.sanitizeUrl(urls.newPullRequestURL) : undefined;
  const compareURL = urls?.compareURL ? textUtil.sanitizeUrl(urls.compareURL) : undefined;
  const branchURL = urls?.sourceURL ? textUtil.sanitizeUrl(urls.sourceURL) : undefined;

  // Migrate is the only flow that reaches here via a sync job, and it just needs
  // the pull request. The branch/compare links are for delete/move jobs.
  const onlyPullRequest = jobType === 'sync';

  return (
    <Stack>
      {!onlyPullRequest && (
        <>
          <LinkButton href={branchURL} icon="external-link-alt" variant="secondary" target="_blank">
            <Trans i18nKey="provisioning.repository-link.delete-or-move-job.view-branch">View branch</Trans>
          </LinkButton>
          <LinkButton href={compareURL} icon="external-link-alt" variant="secondary" target="_blank">
            <Trans i18nKey="provisioning.repository-link.delete-or-move-job.compare-branch">Compare branch</Trans>
          </LinkButton>
        </>
      )}
      <LinkButton href={pullRequestURL} icon="external-link-alt" variant="secondary" target="_blank">
        <Trans i18nKey="provisioning.repository-link.delete-or-move-job.open-pull-request">Open pull request</Trans>
      </LinkButton>
    </Stack>
  );
}
