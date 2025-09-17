import { DataFrameView } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useQueryRunner } from '@grafana/scenes-react';
import { Stack, Text } from '@grafana/ui';

import { Spacer } from '../../components/Spacer';
import { METRIC_NAME } from '../constants';

import { getDataQuery, useQueryFilter } from './utils';

interface Frame {
  alertstate: 'firing' | 'pending';
  Value: number;
}

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
  const firstFrame = data?.series?.at(0);

  if (isLoading || !firstFrame) {
    return <div />;
  }

  const dfv = new DataFrameView<Frame>(firstFrame);
  if (dfv.length === 0) {
    return <div />;
  }

  const firingIndex = dfv.fields.alertstate.values.findIndex((state) => state === 'firing');
  const firingCount = dfv.fields.Value.values[firingIndex] ?? 0;

  const pendingIndex = dfv.fields.alertstate.values.findIndex((state) => state === 'pending');
  const pendingCount = dfv.fields.Value.values[pendingIndex] ?? 0;

  return (
    <Stack direction="column" alignItems="flex-end" gap={0}>
      <Spacer />
      <Text variant="body" color="primary">
        <Trans i18nKey="alerting.summary-stats-react.at-this-moment-you-have">
          Matching the current set of filters:
        </Trans>
      </Text>
      <Text color="error">
        <Trans i18nKey="alerting.triage.firing-instances-count">{{ firingCount }} firing instances</Trans>
      </Text>
      <Text color="warning">
        <Trans i18nKey="alerting.triage.pending-instances-count">{{ pendingCount }} pending instances</Trans>
      </Text>
    </Stack>
  );
}

// simple wrapper so we can render the Chart using a Scene parent
export class SummaryStatsScene extends SceneObjectBase<SceneObjectState> {
  static Component = SummaryStatsReact;
}
