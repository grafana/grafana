import { Stack } from '@grafana/ui';

import { ProvisionedCommitSteps } from '../Shared/ProvisionedCommitSteps';
import { ProvisionedCommitSuccess } from '../Shared/ProvisionedCommitSuccess';
import { type ProvisionedCommitOutcome } from '../Shared/provisionedCommitOutcome';

interface Props {
  outcome: ProvisionedCommitOutcome;
  onDismiss?: () => void;
}

/**
 * What a finished bulk job reports: the same outcome view a single-resource commit shows, so the two
 * paths read alike even though one goes through a job and the other through a file write.
 *
 * No kind is passed, because a selection can span kinds — so the steps offer the pull request and
 * nothing else, and closing is the way out.
 */
export function BulkActionOutcome({ outcome, onDismiss }: Props) {
  return (
    <Stack direction="column" gap={3}>
      <ProvisionedCommitSuccess outcome={outcome} />
      <Stack gap={2} wrap="wrap">
        <ProvisionedCommitSteps outcome={outcome} onDismiss={() => onDismiss?.()} />
      </Stack>
    </Stack>
  );
}
