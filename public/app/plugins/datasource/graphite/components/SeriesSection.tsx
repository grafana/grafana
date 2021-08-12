import React from 'react';
import { Dispatch } from 'redux';
import { GraphiteQueryEditorState } from '../state/store';
import { TagsSection } from './TagsSection';
import { MetricsSection } from './MetricsSection';

type Props = {
  dispatch: Dispatch;
  state: GraphiteQueryEditorState;
};

export function SeriesSection({ dispatch, state }: Props) {
  return state.queryModel?.seriesByTagUsed ? (
    <TagsSection
      dispatch={dispatch}
      tags={state.queryModel?.tags}
      addTagSegments={state.addTagSegments}
      state={state}
    />
  ) : (
    <MetricsSection dispatch={dispatch} segments={state.segments} state={state} />
  );
}
