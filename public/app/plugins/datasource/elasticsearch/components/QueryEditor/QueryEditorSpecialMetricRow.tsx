import { InlineFieldRow, InlineLabel, InlineSegmentGroup } from '@grafana/ui';

import { MetricAggregation } from '../../dataquery.gen';

import { SettingsEditor } from './MetricAggregationsEditor/SettingsEditor';

type Props = {
  name: string;
  metric: MetricAggregation;
};

export const QueryEditorSpecialMetricRow = ({ name, metric }: Props) => {
  // this widget is only used in scenarios when there is only a single
  // metric, so the array of "previousMetrics" (meaning all the metrics
  // before the current metric), is an ampty-array
  const previousMetrics: MetricAggregation[] = [];

  return (
    <InlineFieldRow>
      <InlineSegmentGroup>
        <InlineLabel width={17} as="div">
          <span>{name}</span>
        </InlineLabel>
      </InlineSegmentGroup>
      <SettingsEditor metric={metric} previousMetrics={previousMetrics} />
    </InlineFieldRow>
  );
};
