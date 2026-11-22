import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Button, LinkButton, Stack } from '@grafana/ui';
import { type RepoType } from 'app/features/provisioning/Wizard/types';

import { type CommitAction, ProvisionedCommitSuccess } from '../Shared/ProvisionedCommitSuccess';

/**
 * Everything the drawer needs to report a landed commit, snapshotted when it lands.
 *
 * It is a snapshot rather than a live lookup because the save moves the ground underneath one: a
 * created dashboard stops being a new save, and a dashboard committed to a branch is not in Grafana
 * at all, so re-resolving the repository afterwards finds nothing.
 */
export interface DashboardCommitOutcome {
  action: CommitAction;
  /** Branch the commit landed on; absent for a direct write to the configured branch. */
  branch?: string;
  configuredBranch?: string;
  repoType?: RepoType;
  repoUrl?: string;
  message: string;
  hash?: string;
  /** Link to the committed file at `hash`. */
  sourceUrl?: string;
  /** Pull request the pushed branch opens, where the provider has one. */
  prUrl?: string;
  /** Where "View dashboard" goes: the branch preview, or the saved dashboard. */
  viewUrl?: string;
}

interface Props {
  outcome: DashboardCommitOutcome;
}

/** What the dashboard save drawer shows once the commit has landed. */
export function ProvisionedDashboardOutcome({ outcome }: Props) {
  const navigate = useNavigate();
  // A plain git remote opens no pull request, so the way out to the server is the repository itself.
  const externalUrl = outcome.prUrl || (outcome.branch ? outcome.repoUrl : undefined);

  return (
    <Stack direction="column" gap={3}>
      <ProvisionedCommitSuccess
        action={outcome.action}
        branch={outcome.branch}
        configuredBranch={outcome.configuredBranch}
        repoType={outcome.repoType}
        repoUrl={outcome.repoUrl}
        commitMessage={outcome.message}
        commitHash={outcome.hash}
        sourceUrl={outcome.sourceUrl}
      />
      <Stack gap={2} wrap="wrap">
        {externalUrl && (
          <LinkButton href={externalUrl} target="_blank" variant="primary" icon="external-link-alt">
            {outcome.prUrl
              ? t('dashboard-scene.save-provisioned-dashboard-form.open-pull-request', 'Open pull request')
              : t('dashboard-scene.save-provisioned-dashboard-form.open-repository', 'Open repository')}
          </LinkButton>
        )}
        {outcome.viewUrl && (
          <Button variant="secondary" onClick={() => navigate(outcome.viewUrl!)}>
            <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.view-dashboard">View dashboard</Trans>
          </Button>
        )}
        <Button variant="secondary" onClick={() => navigate('/dashboards')}>
          <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.back-to-dashboards">
            Back to all dashboards
          </Trans>
        </Button>
      </Stack>
    </Stack>
  );
}
