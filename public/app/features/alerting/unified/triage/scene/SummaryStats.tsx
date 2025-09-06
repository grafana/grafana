import { DataFrameView } from '@grafana/data';
import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useQueryRunner } from '@grafana/scenes-react';
import { Stack, Text } from '@grafana/ui';

import { Spacer } from '../../components/Spacer';
import { METRIC_NAME } from '../constants';

import { getDataQuery, useQueryFilter } from './utils';

export function SummaryStatsReact() {
  const filter = useQueryFilter();

  const dataProvider = useQueryRunner({
    queries: [
      getDataQuery(`count by (alertstate) (${METRIC_NAME}{${filter}})`, {
        instant: true,
        exemplar: false,
        format: 'table',
      }),
    ],
  });

  const isLoading = !dataProvider.isDataReadyToDisplay;
  const data = dataProvider.useState().data;

  if (isLoading || !data?.series) {
    return null;
  }

  const dfv = new DataFrameView(data.series[0]);

  const firingIndex = dfv.fields.alertstate.values.findIndex((state) => state === 'firing');
  const firingCount = dfv.fields.Value.values[firingIndex] ?? 0;

  const pendingIndex = dfv.fields.alertstate.values.findIndex((state) => state === 'pending');
  const pendingCount = dfv.fields.Value.values[pendingIndex] ?? 0;

  return (
    <Stack direction="column" alignItems="flex-end" gap={0}>
      <Spacer />
      <Text color="error">{firingCount} firing instances</Text>
      <Text color="warning">{pendingCount} pending instances</Text>
    </Stack>
  );
}

// simple wrapper so we can render the Chart using a Scene parent
export class SummaryStatsScene extends SceneObjectBase<SceneObjectState> {
  static Component = SummaryStatsReact;
}
