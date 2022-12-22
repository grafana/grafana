import React from 'react';

import { SegmentSection } from '@grafana/ui';

import { GraphiteQueryEditorState } from '../state/store';

import { MetricsSection } from './MetricsSection';
import { TagsSection } from './TagsSection';

type Props = {
  state: GraphiteQueryEditorState;
};

export function SeriesSection({ state }: Props) {
  const sectionContent = state.queryModel?.seriesByTagUsed ? (
    <TagsSection tags={state.queryModel?.tags} state={state} />
  ) : (
    <MetricsSection segments={state.segments} state={state} />
  );

  return (
    <SegmentSection label="Series" fill={true}>
      {sectionContent}
    </SegmentSection>
  );
}
