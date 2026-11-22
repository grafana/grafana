import { Trans, t } from '@grafana/i18n';
import { Button, LinkButton, Stack } from '@grafana/ui';
import { type RepositoryUrLs, type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { appendPullRequestTitleParam } from '../../utils/pullRequestTitle';
import { ProvisionedCommitSuccess } from '../Shared/ProvisionedCommitSuccess';

interface Props {
  action: 'move' | 'delete';
  /** Branch the job pushed to; absent when it wrote to the configured branch. */
  jobRef?: string;
  repository: RepositoryView;
  urls?: RepositoryUrLs;
  commitMessage?: string;
  /** How many resources the action covered, so the copy reads as plural. */
  count: number;
  /** Rendered pull-request title, which prefills the provider's "open pull request" form. */
  prTitle?: string;
  onDismiss?: () => void;
}

/**
 * What a finished bulk job reports: the same outcome view a single-resource commit shows, so the
 * two paths read alike even though one goes through a job and the other through a file write.
 *
 * Bulk offers no way on to a resource — the action covered many — so the only step out is closing.
 */
export function BulkActionOutcome({
  action,
  jobRef,
  repository,
  urls,
  commitMessage,
  count,
  prTitle,
  onDismiss,
}: Props) {
  const prUrl = appendPullRequestTitleParam(urls?.newPullRequestURL, repository.type, prTitle);

  return (
    <Stack direction="column" gap={3}>
      <ProvisionedCommitSuccess
        action={action}
        branch={jobRef}
        configuredBranch={repository.branch}
        repoType={repository.type}
        repoUrl={urls?.repositoryURL ?? repository.url}
        commitMessage={commitMessage}
        count={count}
      />
      <Stack gap={2} wrap="wrap">
        {prUrl && (
          <LinkButton href={prUrl} target="_blank" variant="primary" icon="external-link-alt">
            <Trans i18nKey="provisioning.bulk-action-outcome.open-pull-request">Open pull request</Trans>
          </LinkButton>
        )}
        <Button variant="secondary" onClick={onDismiss}>
          {t('provisioning.bulk-action-outcome.close', 'Close')}
        </Button>
      </Stack>
    </Stack>
  );
}
