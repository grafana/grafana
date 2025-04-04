import React from 'react';

import { Alert, Button } from '@grafana/ui';

import { TempoQuery } from '../dataquery.gen';

export function AggregateByAlert({
  query,
  onChange,
}: {
  query: TempoQuery;
  onChange?: () => void;
}): React.ReactNode | null {
  return query.groupBy ? (
    <Alert title="" severity="info">
      The aggregate by feature has been removed. We recommend using Traces Drilldown app instead. &nbsp;
      <Button onClick={onChange}>Remove aggregate by from this query</Button>
    </Alert>
  ) : null;
}
