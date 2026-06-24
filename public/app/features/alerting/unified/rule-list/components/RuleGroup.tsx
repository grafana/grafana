import { useMeasure } from 'react-use';

import { LoadingBar } from '@grafana/ui';

export const LoadingIndicator = ({ datasourceUid }: { datasourceUid: string }) => {
  const [ref, { width }] = useMeasure<HTMLDivElement>();

  return (
    <div ref={ref} data-testid={`ds-loading-indicator-${datasourceUid}`}>
      <LoadingBar width={width} />
    </div>
  );
};
