import React from 'react';

import { Button } from '@grafana/ui';

type Props = {
  isLoading: boolean;
  error: string;
  onClick?: () => void;
};

export function ApplyMetricNamesButton({ isLoading, error, onClick }: Props) {
  const icon = isLoading ? 'fa fa-spinner' : 'graph-bar';

  const disabled = isLoading || !!error || !onClick;

  const text = isLoading ? `Loading new metric names` : `Apply updated metric names`;

  let tooltip =
    'Changing the time range has resulted in a different set of metric names. Click to apply the recently updated metric names to the results.';

  if (!onClick) {
    tooltip = 'Any recently updated metric names have already been applied.';
  }

  if (isLoading) {
    tooltip = 'New metric names are being loaded due to a change in time range or data source.';
  }

  return (
    <Button {...{ icon, disabled, tooltip, onClick }} style={{ width: 256 }}>
      {text}
    </Button>
  );
}
