import { SegmentSection } from '@grafana/ui';
import React from 'react';
import { PromQueryEditorProps } from '../components/types';
import { MetricSelect } from './MetricSelect';

export const PromQueryBuilder = React.memo<PromQueryEditorProps>((props) => {
  return (
    <div>
      <SegmentSection label="Metric" fill={true}>
        <MetricSelect />
      </SegmentSection>
      <SegmentSection label="Labels" fill={true}>
        <div />
      </SegmentSection>
      <SegmentSection label="Operations" fill={true}>
        <div />
      </SegmentSection>
    </div>
  );
});

PromQueryBuilder.displayName = 'PromQueryBuilder';
