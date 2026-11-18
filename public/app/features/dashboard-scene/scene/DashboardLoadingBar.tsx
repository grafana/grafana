import { useMeasure } from 'react-use';

import { LoadingBar } from '@grafana/ui';

export function DashboardLoadingBar({ label }: { label: string }) {
  const [ref, { width }] = useMeasure<HTMLDivElement>();

  return (
    <div ref={ref}>
      <LoadingBar width={width} ariaLabel={label} />
    </div>
  );
}
