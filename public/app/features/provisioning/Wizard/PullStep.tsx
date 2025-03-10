import { useEffect } from 'react';

import { Alert, Stack } from '@grafana/ui';

export interface PullStepProps {
  onStatusChange: (success: boolean) => void;
}

export function PullStep({ onStatusChange }: PullStepProps) {
  useEffect(() => {
    // Mark this step as successful immediately since it's just informational
    onStatusChange(true);
  }, [onStatusChange]);

  return (
    <Stack direction="column" gap={3}>
      <Alert severity="success" title="Successful connection!">
        Your repository has been configured successfully and will start pulling dashboards shortly.
      </Alert>
    </Stack>
  );
}
