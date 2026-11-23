import { Stack } from '@grafana/ui';

import { ProvisionedCommitSteps } from '../Shared/ProvisionedCommitSteps';
import { ProvisionedCommitSuccess } from '../Shared/ProvisionedCommitSuccess';
import { type ProvisionedCommitOutcome } from '../Shared/provisionedCommitOutcome';

/**
 * A landed dashboard commit, which is the shared outcome plus the two things only dashboards have:
 * the name the commit gave the dashboard, and a branch commit's preview page.
 */
export interface DashboardCommitOutcome extends ProvisionedCommitOutcome {
  /** `metadata.name` the write reported, for the step onto the dashboard's own page. */
  resourceName?: string;
  /** Where a commit on a branch is previewed, which only dashboards have a page for. */
  branchViewUrl?: string;
}

interface Props {
  outcome: DashboardCommitOutcome;
  onDismiss: () => void;
}

/** What the dashboard save drawer shows once the commit has landed. */
export function ProvisionedDashboardOutcome({ outcome, onDismiss }: Props) {
  return (
    <Stack direction="column" gap={3}>
      <ProvisionedCommitSuccess outcome={outcome} />
      <Stack gap={2} wrap="wrap">
        <ProvisionedCommitSteps
          kindKey="dashboard"
          outcome={outcome}
          resourceName={outcome.resourceName}
          branchViewUrl={outcome.branchViewUrl}
          onDismiss={onDismiss}
        />
      </Stack>
    </Stack>
  );
}
