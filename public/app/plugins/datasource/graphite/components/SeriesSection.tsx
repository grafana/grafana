import React from 'react';
import { GraphiteQueryEditorState } from '../state/store';
import { TagsSection } from './TagsSection';
import { MetricsSection } from './MetricsSection';

type Props = {
  state: GraphiteQueryEditorState;
};

export function SeriesSection({ state }: Props) {
  return state.queryModel?.seriesByTagUsed ? (
    <TagsSection tags={state.queryModel?.tags} addTagSegments={state.addTagSegments} state={state} />
  ) : (
    <MetricsSection segments={state.segments} state={state} />
  );
}
